// ======================================================
// 체크인ON 기본폼 - 자동 지역 시스템
// ======================================================

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbwyqwR8t8G0pIdpJRS6M_odih_4eK1C7pKb3LVkVb0vPfwjl09xWysWiix4kdvpwFou/exec";

// ======================================================
// 1. 현재 지역 설정
// ======================================================
const urlParams = new URLSearchParams(window.location.search);
const REGION_CODE =
  urlParams.get("region") || "";
const DONG_PARAM =
  urlParams.get("dong") || "";
// ======================================================
// 2. 지역 기본 설정
// ======================================================
// 현재 지역
let currentRegion = null;

// 현재 동
let currentDong =
  DONG_PARAM || "";

// 현재 카테고리
let currentCategory =
  "전체";
// ======================================================
// 3. 전역 변수
// ======================================================

let map = null;
let markers = [];
let allStores = [];
let allCoupons = [];
let filteredStores = [];

// 자동 생성 지역 목록
let provinceList = [];
let cityList = [];
let dongList = [];

// ======================================================
// ⭐ 지역 데이터 자동 생성
// Google Sheets의 매장 주소를 기준으로 자동 생성
// ======================================================

function buildRegionLists() {

  provinceList = [];
  cityList = [];
  dongList = [];

  const provinceSet =
    new Set();

  const citySet =
    new Set();

  const dongSet =
    new Set();

  allStores.forEach(store => {

    const address =
      (store.address || "").trim();

    if (!address) {
      return;
    }

    // --------------------------
    // 도 / 특별시 / 광역시
    // --------------------------

    const provinceMatch =
      address.match(
        /^(서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|경기도|강원특별자치도|충청북도|충청남도|전북특별자치도|전라남도|경상북도|경상남도|제주특별자치도)/
      );

    if (
      provinceMatch
    ) {

      provinceSet.add(
        provinceMatch[1]
      );

    }

    // --------------------------
    // 시 / 군 / 구
    // --------------------------

    const cityMatch =
      address.match(
        /(?:특별시|광역시|특별자치시|도|특별자치도)\s*([가-힣]+(?:시|군|구))/
      );

    if (
      cityMatch
    ) {

      citySet.add(
        cityMatch[1]
      );

    }

    // --------------------------
    // 읍 / 면 / 동
    // --------------------------

    const dongMatch =
      address.match(
        /([가-힣]+(?:읍|면|동))/
      );

    if (
      dongMatch
    ) {

      dongSet.add(
        dongMatch[1]
      );

    }

  });

  provinceList =
    Array.from(
      provinceSet
    ).sort();

  cityList =
    Array.from(
      citySet
    ).sort();

  dongList =
    Array.from(
      dongSet
    ).sort();

  console.log(
    "🌎 자동 생성 도 목록:",
    provinceList
  );

  console.log(
    "🏙️ 자동 생성 시·군·구 목록:",
    cityList
  );

  console.log(
    "🏠 자동 생성 읍·면·동 목록:",
    dongList
  );

}

// ======================================================
// 4. 지도 초기화
// ======================================================

function initMap() {
  map = L.map("map", {
    minZoom: 6,
    maxZoom: 19
  }).setView(

    [37.8801084, 127.7497714],
    9
  );
  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution:
        "&copy; OpenStreetMap contributors",
      maxZoom: 19
    }
  ).addTo(map);
}

// ======================================================
// 5. 이벤트 진행 여부
// ======================================================

function isEventActive(store) {
  if (
    !store.eventStart ||
    !store.eventEnd
  ) {
    return false;
  }
  const now =
    Date.now();
  const start =
    new Date(
      store.eventStart
    ).getTime();
  const end =
    new Date(
      store.eventEnd
    ).getTime();
  return (
    now >= start &&
    now <= end
  );
}

// ======================================================
// 6. 최근 검색
// ======================================================

function saveRecentSearch(keyword) {
  let recent =
    JSON.parse(
      localStorage.getItem(
        "recentSearches"
      ) || "[]"
    );
  recent =
    recent.filter(
      v => v !== keyword
    );
  recent.unshift(keyword);
  recent =
    recent.slice(0, 5);
  localStorage.setItem(
    "recentSearches",
    JSON.stringify(recent)
  );
}
function getRecentSearches() {
  return JSON.parse(
    localStorage.getItem(
      "recentSearches"
    ) || "[]"
  );
}

// ======================================================
// 7. 지역 코드가 없는 경우
// ======================================================

function showRegionMessage() {
  if (currentRegion) {
    return;
  }
  console.log(
    "현재 지역 코드가 없습니다."
  );
}

// ======================================================
// 8. 지역 필터
// ======================================================

function getRegionStores() {
  // 현재 지역이 선택되지 않았다면
  // 전체 매장을 대상으로 사용
  if (!currentRegion) {
    return allStores;
  }

  return allStores.filter(
    store => {
      const address =
        store.address || "";

      return address.includes(
        currentRegion.name
      );
    }
  );
}

// ======================================================
// 9. 동 필터
// ======================================================

function normalizeDong(dong) {
  if (!dong) {
    return "";
  }
  return dong
    .replace(
      /([가-힣]+)[1-9]동/g,
      "$1동"
    )
    .trim();
}
function isDongMatch(
  address,
  dong
) {
  if (
    !address ||
    !dong
  ) {
    return false;
  }
  const normalizedDong =
    normalizeDong(dong);
  const normalizedAddress =
    normalizeDong(address);
  return normalizedAddress
    .includes(
      normalizedDong
    );
}

// ======================================================
// 10. 전체 필터
// ======================================================

function applyFilter() {
  // 현재 시·군이 선택되어 있으면 해당 지역 매장만
  // 현재 시·군이 없으면 전체 매장을 대상으로 검색
  let filtered =
    currentRegion
      ? getRegionStores()
      : allStores;

  // 동 필터
  if (
    currentDong
  ) {
    filtered =
      filtered.filter(
        store =>
          isDongMatch(
            store.address || "",
            currentDong
          ) ||
          (
            store.dong || ""
          ).includes(
            normalizeDong(
              currentDong
            )
          )
      );
  }

  // 카테고리 필터
  if (
    currentCategory &&
    currentCategory !== "전체"
  ) {
    filtered =
      filtered.filter(
        store =>
          store.category ===
          currentCategory
      );
  }

  filteredStores = filtered;

  renderMarkers(
    filtered
  );

  updateStats(
    filtered
  );
}

// ======================================================
// 11. 통계
// ======================================================

function updateStats(
  filteredStores
) {
  const stores =
    filteredStores || [];
  const eventCount =
    stores.filter(
      store =>
        store.status ===
          "active" &&
        isEventActive(
          store
        )
    ).length;
  const activeCount =
    stores.filter(
      store =>
        store.status ===
        "active"
    ).length;
  const pendingCount =
    stores.filter(
      store =>
        store.status ===
        "pending"
    ).length;
  const eventEl =
    document.getElementById(
      "eventCount"
    );
  const storeEl =
    document.getElementById(
      "storeCount"
    );
  const pendingEl =
    document.getElementById(
      "pendingCount"
    );
  if (eventEl) {
    eventEl.textContent =
      eventCount;
  }
  if (storeEl) {
    storeEl.textContent =
      activeCount;
  }
  if (pendingEl) {
    pendingEl.textContent =
      pendingCount;
  }
}
// ======================================================
// 12. 지도 마커 렌더링
// ======================================================

function renderMarkers(
  storesData
) {
  if (!map) {
    return;
  }
  markers.forEach(
    marker =>
      map.removeLayer(
        marker
      )
  );
  markers = [];
  (
    storesData || []
  ).forEach(
    store => {
      const lat =
        Number(
          store.lat
        );
      const lng =
        Number(
          store.lng
        );
      if (
        !lat ||
        !lng
      ) {
        return;
      }
      const status =
        store.status ||
        "pending";
      const emoji =
        status ===
        "active"
          ? "💖"
          : "💛";  // 🩷 ❤️ 🧡 💛 💚 💙 💜 🤎 🖤 🤍 🩵 🩶🎉 🎊 🎁 🎈 🪅 🥳 🎂 🍰 🧁 🎇 🎆

      //💰 💵 💴 💶 💷 💸 💳 🤑 🪙 🏆 🏅 🎖️ 🎯 🎮 🕹️ 🎲 🧩 🎰 🔔 📣 📢 🪄 🔥 ⚡ 💥 🚀 🌈 🍀 🧲 🎀 🎗️ 🛍️ 🛒
      // 👉 👈 👆 👇 👇 🫵 🖱️ 👆🏻  💕 💖 💗 💓 💞 💘 💝 💟 👑 💍💎 💠 🔷 🔹 🔶 🔸 🪙 🏆 🥇 🥈 🥉 

      const showBadge =
        status ===
          "active" &&
        isEventActive(
          store
        );
      const icon =
        L.divIcon({
          className:
            "custom-pin",
          html: `
            <div
              style="
                position:relative;
                display:inline-block;
                text-align:center;
              "
            >
              <span
                style="
                  font-size:${
                    status === "active"     /////////////////////////  하트 크기 줄이는 코드
                      ? 17
                      : 10
                  }px;
                  text-shadow:
                    0 1px 3px
                    rgba(0,0,0,0.4);
                  display:block;
                  position:relative;
                  top:${
                    status === "active"
                      ? -2      /////////////////////////////  -6으로 하면 더 위로 올라옴  빨간 하트 위로 올라오게 하는 코드 
                      : 0
                  }px;
                "
              >
                ${emoji}
              </span>
              <div
                style="
                  font-size:${
                    status === "active"
                      ? 10
                      : 8
                  }px;
                  color:${
                    status === "active"
                      ? "#a11000"
                      : "#000000"
                  };
                  white-space:nowrap;
                  margin-top:-3px;
                "
              >
                ${store.storeName || ""}
              </div>
              ${
                    showBadge
                    ? `
                      <div class="event-gift">
                        <span class="event-gift-icon">🎁</span>
                        <div class="event-gift-tooltip">
                          <div class="event-line">🎉 이벤트 🎉</div>
                          <div class="event-text">
                            ${store.discount || "이벤트 상품"}
                          </div>
                          <div class="event-desc">
                            ${store.eventDesc || ""}
                          </div>
                        </div>
                      </div>
                    `
                    : ""
                  }
            </div>
          `,
          iconSize:
            [28, 40],
          iconAnchor:
            [14, 20],
          popupAnchor:
            [5, -3]
        });
      const marker =
        L.marker(
          [
            lat,
            lng
          ],
          {
            icon
          }
        ).addTo(
          map
        );
      marker.bindTooltip(
        store.storeName || "",
        {
          direction:
            "bottom",
          offset:
            [0, 23],
          permanent:
            false,
          sticky:
            true
        }
      );
      let popupContent = `
        <b>
          ${store.storeName || ""}
        </b>
        <br>
        📞
        ${store.phone || "번호 없음"}
        <br>
        🎁
        ${store.discount || "-"}
        <br><br>
      `;
      popupContent += `
        <button
          onclick="
            openWebsite(
              '${store.websiteUrl || ""}',
              '${status}'
            )
          "
        >
          상세 / 홈페이지 보기
        </button>
      `;
      if (
        status !==
        "active"
      ) {
        popupContent += `
          <br><br>
          <span
            style="
              font-size:16px;
              font-weight:bold;
              color:red;
            "
          >
            등록대기중
          </span>
        `;
      }
      marker.bindPopup(
        popupContent
      );
      markers.push(
        marker
      );
    }
  );
}

// ======================================================
// 13. 지역 검색
// ======================================================

async function searchCity() {

  const input =
    document
      .getElementById(
        "cityInput"
      )
      ?.value
      .trim();

  if (!input) {
    return;
  }

  // ======================================================
  // 지역 목록에서 시·군 확인
  // ======================================================

console.log(
  "🔎 검색어:",
  input,
  "현재 cityList:",
  cityList
);

  const matchedCity =
  cityList.find(
    city =>
      city === input ||
      city.replace(
        /(특별자치도|특별자치시|특별시|광역시|도|시|군|구)$/,
        ""
      ) === input
  );

    
  if (!matchedCity) {

    try {

      const res = await fetch(
        GAS_URL +
        "?action=searchStores" +
        "&keyword=" +
        encodeURIComponent(input)
      );

      const data = await res.json();

      const matchedStores =
        Array.isArray(data) ? data : [];

      if (!matchedStores.length) {
        alert("검색 결과가 없습니다.");
        return;
      }

      currentRegion = null;
      currentDong = "";
      currentCategory = "전체";

      filteredStores = matchedStores;

      renderMarkers(matchedStores);
      updateStats(matchedStores);

      const store = matchedStores.find(
        item => Number(item.lat) && Number(item.lng)
      );

      if (store && map) {
        map.setView(
          [Number(store.lat), Number(store.lng)],
          16,
          { animate: true }
        );
      }

      saveRecentSearch(input);

    } catch (err) {

      console.error("매장 검색 실패:", err);
      alert("매장 검색 중 오류가 발생했습니다.");

    }

    return;
  }


  // ======================================================
  // GAS에서 해당 지역 매장만 가져오기
  // ======================================================

  try {

    const res =
      await fetch(
        GAS_URL +
        "?action=getStoreMapData" +
        "&city=" +
        encodeURIComponent(
          matchedCity
        )
      );

    const data =
      await res.json();

    // ======================================================
    // 해당 지역 매장 저장
    // ======================================================

    allStores =
      Array.isArray(
        data
      )
        ? data
        : [];

    console.log(
      "🏙️ 선택 지역:",
      matchedCity
    );

    console.log(
      "🏪 지역 매장:",
      allStores.length
    );

    if (
      !allStores.length
    ) {

      alert(
        "등록된 매장이 없는 지역입니다."
      );

      return;
    }

    // ======================================================
    // 현재 지역 설정
    // ======================================================

    currentRegion = {
      name:
        matchedCity,
      type:
        "city"
    };

        // 화면 제목 변경
    updateSiteTitle(matchedCity);

    // 인터넷 브라우저 탭 제목 변경
    document.title =
      `${matchedCity.replace(/\s*(시|군|구)$/, "")} 체크인ON(우리동네할인/쿠폰)`;

    // 지도 첫 화면 안내 숨기기
    const mapGuide =
      document.getElementById("mapGuide");

    if (mapGuide) {
      mapGuide.classList.add("hidden");
    }

    localStorage.setItem(
      "currentCity",
      matchedCity
    );

    currentDong =
      "";

    currentCategory =
      "전체";

    // ======================================================
    // 첫 번째 매장 위치로 지도 이동
    // ======================================================

    const store =
      allStores[0];

    if (
      store &&
      store.lat &&
      store.lng
    ) {

      map.setView(
        [
          Number(
            store.lat
          ),
          Number(
            store.lng
          )
        ],
        17,   /////////////   지역선택에서 예) 춘천시를 검색하면 해당 지도가 확대되는 코드 숫자를 높이면 확대됨.
        {
          animate:
            true
        }
      );

    }

    // ======================================================
    // 해당 지역 매장만 마커 표시
    // ======================================================

    applyFilter();

    // ======================================================
    // 지역 변경 후 티커 광고 갱신
    // ======================================================

    if (
      typeof updateTickerByRegion ===
      "function"
    ) {

      updateTickerByRegion();

    }

  }
  catch (
    err
  ) {

    console.error(
      "지역 매장 조회 실패:",
      err
    );

    alert(
      "지역 매장을 불러오지 못했습니다."
    );

  }

}

// ======================================================
// 14. 동 / 주소 / 도로명 / 번지 / 매장명 검색
// ======================================================


function searchDong() {
  const input =
    document
      .getElementById("dongInput")
      ?.value
      .trim();

  if (!input) {
    return;
  }

  const keyword = input.toLowerCase();

  // 현재 선택한 지역 안에서 검색
  const regionStores =
    currentRegion
      ? getRegionStores()
      : allStores;

  // 동 이름, 주소, 도로명, 번지, 매장명 검색
  const matchedStores =
    regionStores.filter(store => {
      const address =
        String(store.address || "").toLowerCase();

      const dong =
        String(store.dong || "").toLowerCase();

      const storeName =
        String(store.storeName || "").toLowerCase();

      return (
        address.includes(keyword) ||
        dong.includes(keyword) ||
        storeName.includes(keyword) ||
        normalizeDong(address).includes(
          normalizeDong(input)
        ) ||
        normalizeDong(dong).includes(
          normalizeDong(input)
        )
      );
    });

  if (!matchedStores.length) {
    alert("검색 결과가 없습니다.");
    return;
  }

  // 검색한 매장들을 지도에 표시
  // 동 이름 검색이면 동 선택 상태 유지
  const isDongSearch =
    matchedStores.some(store =>
      normalizeDong(store.dong || "") ===
        normalizeDong(input) ||
      isDongMatch(store.address || "", input)
    );

  currentDong =
    isDongSearch
      ? normalizeDong(input)
      : "";

  currentCategory = "전체";

  filteredStores = matchedStores;

  renderMarkers(matchedStores);
  updateStats(matchedStores);

  // 검색 결과 중 좌표가 있는 첫 매장으로 이동
  const firstStore = matchedStores.find(store =>
    Number(store.lat) && Number(store.lng)
  );

  if (firstStore && map) {
    map.setView(
      [
        Number(firstStore.lat),
        Number(firstStore.lng)
      ],
      16,
      { animate: true }
    );
  }

  saveRecentSearch(input);

  if (typeof updateTickerByRegion === "function") {
    updateTickerByRegion();
  }

  console.log("🔎 검색어:", input);
  console.log("🏪 검색 결과:", matchedStores.length);
}


// ======================================================
// 15. 카테고리 필터
// ======================================================

function filterCategory(
  category
) {
  currentCategory =
    category;
  if (
    category ===
    "전체"
  ) {
    currentDong =
      "";
  }
  applyFilter();
}

// ======================================================
// 16. 외부 홈페이지
// ======================================================

function openWebsite(
  url,
  status
) {
  if (!url) {
    alert(
      "등록된 홈페이지가 없습니다."
    );
    return;
  }

  window.open(
    url,
    "_blank"
  );
}


////////////////////////////////////// 여기에 있는 주석을 풀면 등록대기 매장은 상세/홈페이지를 불 수 없음.
function openWebsite(
  url,
  status
) {
  if (
    status ===
    "pending"
  ) {
    alert(
      "정식등록이 필요합니다."
    );
    return;
  }
  if (!url) {
    alert(
      "등록된 홈페이지가 없습니다."
    );
    return;
  }
  window.open(
    url,
    "_blank"
  );
}
//*/


async function loadRegions() {

  try {

    const res =
      await fetch(
        GAS_URL +
        "?action=getRegions"
      );

    const data =
      await res.json();

    const regions =
  Array.isArray(data)
    ? data
    : [];

cityList =
  regions
    .map(
      region =>
        String(
          region.city || ""
        ).trim()
    )
    .filter(
      city =>
        city !== ""
    );

console.log(
  "📍 자동 지역 목록:",
  cityList
);

    // ======================================================
    // 지역 목록에서 시·군·구 이름 자동 생성
    // ======================================================

    cityList =
      regions
        .map(
          region =>
            String(
              region.city || ""
            ).trim()
        )
        .filter(
          city =>
            city !== ""
        );

    console.log(
      "📍 지역 목록:",
      regions
    );

    console.log(
      "🏙️ 등록된 지역 수:",
      regions.length
    );

    console.log(
      "🏙️ 검색 가능한 시·군·구:",
      cityList
    );

  }
  catch (err) {

    console.error(
      "지역 목록 로드 실패:",
      err
    );

  }

}

// ======================================================
// 기존 매장 로드
// ======================================================

async function loadStores() {

  // ======================================================
  // 초기 접속에서는 전체 매장을 불러오지 않음
  // ======================================================

  allStores = [];

  console.log(
    "📦 초기 접속: 전체 매장 불러오지 않음"
  );

}

// ======================================================
// 18. 현재 지역으로 지도 이동
// ======================================================

function moveToCurrentRegion() {
  const regionStores =
    getRegionStores();
  if (
    !regionStores.length
  ) {
    console.log(
      "현재 지역 매장 없음"
    );
    return;
  }
  let targetStores =
    regionStores;
  if (
    currentDong
  ) {
    targetStores =
      regionStores.filter(
        store =>
          isDongMatch(
            store.address || "",
            currentDong
          )
      );
  }
  const firstStore =
    (
      targetStores[0] ||
      regionStores[0]
    );
  if (
    !firstStore
  ) {
    return;
  }
  map.setView(
    [
      Number(
        firstStore.lat
      ),
      Number(
        firstStore.lng
      )
    ],
    currentDong
      ? 15
      : 13,
    {
      animate:
        true
    }
  );
}

// ======================================================
// 19. 엔터 검색
// ======================================================

document
  .getElementById(
    "cityInput"
  )
  ?.addEventListener(
    "keypress",
    function(e) {
      if (
        e.key ===
        "Enter"
      ) {
        searchCity();
      }
    }
  );
document
  .getElementById(
    "dongInput"
  )
  ?.addEventListener(
    "keypress",
    function(e) {
      if (
        e.key ===
        "Enter"
      ) {
        searchDong();
      }
    }
  );


// ======================================================
// 20. 초기 실행
// ======================================================

window.addEventListener(
  "DOMContentLoaded",
  async function() {
    initMap();

    if (
      currentRegion
    ) {
      document.title =
        `${currentRegion.name} 체크인ON(우리동네할인/쿠폰)`;  // 인터넷 브라우저의 탭에 표시되는 제목
    }

    await loadRegions();
  }
);


function goAdmin() {   //  이 코드를 주석처리하고 밑에 있는 주석코드를 풀면 비번을 넣고 관리자페이지로 감.
    window.location.href = "admin.html";
}

/*///////////////////    나중에 고객페이지에서 관리자페이지로 넘어갈 때 비번코드임. 주석 풀면 비번을 넣어야 함.
function goAdmin() {
    const password = prompt("관리자 비밀번호를 입력하세요.");

    if (password === "8282") {
        window.location.href = "admin.html";
    } else if (password !== null) {
        alert("비밀번호가 올바르지 않습니다.");
    }
}
*/

function updateSiteTitle(region) {
  const regionName = document.getElementById("regionName");
  const titleSpace = document.getElementById("titleSpace");

  if (!regionName || !titleSpace) return;

  const name = String(region || "")
    .trim()
    .replace(/\s*(시|군|구)$/, "");

  regionName.textContent = name;
  titleSpace.textContent = name ? " " : "";
}

// 이벤트 카드 클릭
let eventPopupStores = [];
let eventPopupIndex = 0;

function openEventPopup() {
  eventPopupStores = filteredStores.filter(store =>
    store.status === "active" &&
    isEventActive(store) &&
    store.websiteUrl &&
    store.websiteUrl.trim() !== ""
  );

  if (eventPopupStores.length === 0) {
    alert("현재 지역에 진행 중인 이벤트 매장이 없습니다.");
    return;
  }

  eventPopupIndex = 0;

  const popup = document.getElementById("eventPopup");
  if (!popup) {
    alert("이벤트 팝업 HTML이 아직 없습니다.");
    return;
  }

  showEventPopupStore();
  popup.style.display = "flex";
}

function showEventPopupStore() {
  const store = eventPopupStores[eventPopupIndex];

  document.getElementById("eventPopupTitle").textContent =
    `${store.dong || ""} - ${store.storeName || "이벤트 매장"}`;

/* //////////////////     이벤트 매장에서 팝업창에 이상하게 나오는 웹사이트 주소 수정하는 코드 */


  const websiteUrl = store.websiteUrl || "";
let mobileUrl = websiteUrl;

try {
  const url = new URL(websiteUrl);

  // 네이버 블로그만 모바일 주소로 변경
  if (url.hostname === "blog.naver.com") {
    url.hostname = "m.blog.naver.com";
  }

  // 카카오맵은 원래 주소 유지
  mobileUrl = url.href;
} catch (error) {
  console.error("이벤트 웹사이트 주소 오류:", error);
}

console.log("원본 주소:", websiteUrl);
console.log("변환 주소:", mobileUrl);

document.getElementById("eventPopupFrame").src =
  mobileUrl || "about:blank";

/*////////////////////////////// 여기에 팝업창에 이상하게 나오는 웹사이트 주소를 수정하는 코드 끝 */



  document.getElementById("eventPopupCounter").textContent =
    `${eventPopupIndex + 1} / ${eventPopupStores.length}`;
}

function prevEventStore() {
  if (!eventPopupStores.length) return;

  eventPopupIndex =
    (eventPopupIndex - 1 + eventPopupStores.length) %
    eventPopupStores.length;

  showEventPopupStore();
}

function nextEventStore() {
  if (!eventPopupStores.length) return;

  eventPopupIndex =
    (eventPopupIndex + 1) % eventPopupStores.length;

  showEventPopupStore();
}

function closeEventPopup() {
  document.getElementById("eventPopup").style.display = "none";
}