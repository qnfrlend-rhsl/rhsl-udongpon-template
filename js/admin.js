const GAS_URL = "https://script.google.com/macros/s/AKfycbw551aqbI179VXkRTAmmLdsVnScywsUAS4J2tbdXZEXTMXwcGXtBVO5KYqDT0_TJlXR/exec";

/* =========================
   🌎 현재 지역 설정
   예:
   admin.html?city=동해시
   admin.html?city=춘천시
   admin.html?city=홍천군
========================= */

const params = new URLSearchParams(window.location.search);
const currentCity =
  params.get("city") ||
  localStorage.getItem("currentCity") ||
  "";

if (currentCity) {
  localStorage.setItem("currentCity", currentCity);
}

console.log("📍 현재 관리자 지역:", currentCity);

// 📢 티커 관리자 화면에 현재 지역 표시
const tickerCityEl =
  document.getElementById("tickerCurrentCity");

if (tickerCityEl) {
  tickerCityEl.textContent =
    currentCity || "전체";
}

// 📢 시·군 광고 입력칸에 현재 지역 자동 표시
const tickerCityDisplay =
  document.getElementById("tickerCityDisplay");

if (tickerCityDisplay) {
  tickerCityDisplay.value =
    currentCity || "";
}
/* =========================
   데이터
========================= */

let allCoupons = [];
let allStores = [];
let isAdmin =
  localStorage.getItem("isAdmin") === "true";

/* =========================
   이벤트 활성 여부
========================= */

function isEventActive(store) {
  if (!store.eventStart || !store.eventEnd) {
    return false;
  }
  const now = Date.now();
  const start =
    new Date(store.eventStart).getTime();
  const end =
    new Date(store.eventEnd).getTime();
  return now >= start && now <= end;
}

/* =========================
   주소 좌표 캐시
========================= */

function getGeoCache() {
  return JSON.parse(
    localStorage.getItem("geoCache") || "{}"
  );
}

function setGeoCache(cache) {
  localStorage.setItem(
    "geoCache",
    JSON.stringify(cache)
  );
}

/* =========================
   주소 → 좌표
========================= */

async function getCoordsFromAddress(address) {
  const geoCache = getGeoCache();
  if (geoCache[address]) {
    return geoCache[address];
  }
  const url =
    `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`;
  const res = await fetch(url, {
    headers: {
      Authorization:
        "KakaoAK 4bc216edc0a1de5f21dd79022ce52f2b"
    }
  });
  const data = await res.json();
  if (
    !data.documents ||
    !data.documents.length
  ) {
    return null;
  }
  const result = {
    lat: data.documents[0].y,
    lng: data.documents[0].x
  };
  geoCache[address] = result;
  setGeoCache(geoCache);
  return result;
}

/* =========================
   ⭐ 쿠폰 로드
========================= */

function loadAdminCoupons() {
  fetch(
    GAS_URL + "?action=getCoupons",
    {
      cache: "no-store"
    }
  )
    .then(res => res.json())
    .then(data => {
      const coupons =
        Array.isArray(data)
          ? data
          : data.data ||
            data.result ||
            [];
      /*
        현재 지역에 등록된 매장의 쿠폰만 표시
      */

      allCoupons = coupons.filter(coupon =>
        allStores.some(store =>
          String(store.storeName || "").trim() ===
          String(coupon.storeName || "").trim()
        )
      );
      renderCoupons("all");
    })
    .catch(err => {
      console.error(
        "쿠폰 로드 실패:",
        err
      );
    });
}

/* =========================
   ⭐ 매장 로드
========================= */

async function loadStores() {
  try {
    const res =
      await fetch(
        GAS_URL + "?action=getStores"
      );
    const data =
      await res.json();
    /*
      기본폼 지역 필터

      지역이 선택되어 있으면
      해당 지역만 표시

      지역이 없으면
      전체 매장을 표시
    */
    allStores =
  (Array.isArray(data)
    ? data
    : [])
  .filter(store =>
    store &&
    typeof store === "object"
  )
  .map(store => ({
    ...store
  }));

// 현재 지역이 선택된 경우에만 해당 지역 매장 필터링
if (currentCity) {
  allStores =
    allStores.filter(
      store =>
        (store.address || "")
          .includes(currentCity)
    );
}

    console.log(
      "📍 현재 지역:",
      currentCity || "전체"
    );

    console.log(
      "🏪 지역 매장:",
      allStores.length
    );
    renderStores();
    updateStoreFilter();
  } catch (err) {
    console.error(
      "매장 로드 실패:",
      err
    );
  }
}
/* =========================
   ⭐ 쿠폰 렌더
========================= */

function renderCoupons(filter) {
  const el =
    document.getElementById(
      "adminList"
    );
  let list =
    allCoupons;
  if (filter !== "all") {
    list =
      allCoupons.filter(c =>
        String(
          c.storeName || ""
        ).trim() ===
        String(
          filter || ""
        ).trim()
      );
  }
  if (!list.length) {
    el.innerHTML =
      "쿠폰 없음";
    return;
  }
  el.innerHTML =
    list.map(c => {
      const isActive =
        c.status === "active";
      const isPaid =
        c.status === "paid";
      const id =
        String(
          c.couponId || ""
        );
      return `
        <div class="card ${isActive ? "" : "expired"}">
          <div class="row flex-row">
            <b>
              👤 ${c.name || "-"}
            </b>
            <div class="status ${
              isActive
                ? "active"
                : isPaid
                ? "paid"
                : "expired"
            }">
              ${
                isActive
                  ? "🟢 사용가능"
                  : isPaid
                  ? "💳 결제완료"
                  : "⚪ 만료"
              }
            </div>
          </div>
          <div class="row">
            📞 ${c.phone || "-"}
          </div>
          <div class="row">
            🏪 ${c.storeName || "-"}
          </div>
          <div class="row">
            🏠 ${c.address || "-"}
          </div>
          <div class="row">
            🕒 ${
              c.issuedAt
                ? new Date(
                    c.issuedAt
                  ).toLocaleString(
                    "ko-KR"
                  )
                : "-"
            }
          </div>
          <div class="btn-area">
            ${
              isActive
              ? `<button
                   onclick="payCoupon('${id}')">
                   결제대기
                 </button>`
              : ""
            }
            <button
              onclick="deleteCoupon('${id}')">
              삭제
            </button>
          </div>
        </div>
      `;
    }).join("");
}

/* =========================
   ⭐ 관리자 로그인
========================= */

function updateAdminButton() {
  const btn =
    document.getElementById(
      "adminBtn"
    );
  if (!btn) return;
  btn.innerText =
    isAdmin
      ? "로그아웃 🔓"
      : "로그인 🔐";
}

function toggleAdmin() {
  if (!isAdmin) {
    const pw =
      prompt(
        "관리자 비밀번호"
      );
    if (pw === "132482") {
      isAdmin = true;
      localStorage.setItem(
        "isAdmin",
        "true"
      );
      alert(
        "관리자 ON 🔓"
      );
     } else {
      alert(
        "비밀번호 틀림"
      );
      return;
    }
  } else {
    isAdmin = false;
    localStorage.removeItem(
      "isAdmin"
    );
    alert(
      "관리자 OFF 🔒"
    );
  }
  loadStores();
  updateAdminButton();
}

function requireAdmin() {
  if (!isAdmin) {
    alert(
      "관리자 권한 필요 🔒"
    );
    return false;
  }
  return true;
}

/* =========================
   ⭐ 매장 관리자 비밀번호
========================= */

function requireStoreOwner(id) {
  const store =
    allStores.find(
      s =>
        String(s.storeId) ===
        String(id)
    );
  if (!store) {
    alert(
      "매장 정보를 찾을 수 없습니다."
    );
    return false;
  }
  const pw =
    prompt(
      "매장 관리자 비밀번호"
    );
  if (
    String(pw) !==
    String(store.storePassword)
  ) {
    alert(
      "비밀번호가 틀립니다."
    );
    return false;
  }
  return true;
}

/* =========================
   ⭐ 매장 렌더
========================= */

function renderStores() {
  const el =
    document.getElementById(
      "storeList"
    );
  if (!allStores.length) {
    el.innerHTML =
      "등록된 매장 없음";
    return;
  }

  const sortedStores =
    [...allStores].sort(
      (a, b) => {
        const aEvent =
          isEventActive(a);
        const bEvent =
          isEventActive(b);
        return (
          (bEvent ? 1 : 0) -
          (aEvent ? 1 : 0)
        );
      }
    );

  el.innerHTML =
    sortedStores.map(s => {
      const eventActive =
        isEventActive(s);
      return `
        <div class="card">
          <b>
            🏪 ${s.storeName}
          </b>
          <br>
          📍 ${
            s.address || "-"
          }
          <br>
          📞 ${
            s.phone || "-"
          }
          <br>
          🎁 ${
            s.discount || "-"
          }
          <br>
          ${
            eventActive
              ? "🔥 이벤트 진행중"
              : ""
          }
          <div class="status ${
            s.status === "active"
              ? "active"
              : "expired"
          }">
            ${
              s.status === "active"
                ? "운영중"
                : "등록대기"
            }
          </div>
          <br>
          <button
            onclick="editStore('${s.storeId}')">
            수정
          </button>
          <button
            onclick="editEvent('${s.storeId}')">
            🎁 이벤트 등록
          </button>
          <br>
          <button
            onclick="deleteStore('${s.storeId}')">
            삭제
          </button>
          <button
            onclick="setStoreStatus('${s.storeId}','active')">
            등록
          </button>
          <button
            onclick="setStoreStatus('${s.storeId}','pending')">
            등록대기
          </button>
        </div>
      `;
    }).join("");
}

/* =========================
   ⭐ 매장 상태 변경
========================= */

function setStoreStatus(
  storeId,
  mode
) {
  if (!requireAdmin()) return;
  const statusValue =
    mode === "active"
      ? "active"
      : "pending";
  fetch(
    GAS_URL +
    "?action=updateStoreStatus" +
    "&storeId=" +
    encodeURIComponent(
      storeId
    ) +
    "&status=" +
    encodeURIComponent(
      statusValue
    )
  )
  .then(res =>
    res.json()
  )
  .then(data => {
    if (data.success) {
      alert(
        "등록되었습니다"
      );
      loadStores();
    } else {
      alert(
        "상태 변경 실패"
      );
    }
  })
  .catch(err => {
    console.error(err);
    alert(
      "상태 변경 중 오류 발생"
    );
  });
}

/* =========================
   ⭐ 매장 등록
========================= */

async function addStore(
  status = "active"
) {
  if (!requireAdmin()) return;
  const storeName =
    document.getElementById(
      "storeName"
    )?.value || "";
  const category =
    document.getElementById(
      "storeCategory"
    )?.value || "";
  const dong =
    document.getElementById(
      "storeDong"
    )?.value || "";
  const address =
    document.getElementById(
      "storeAddress"
    )?.value || "";
  const phone =
    document.getElementById(
      "storePhone"
    )?.value || "";
  const discount =
    document.getElementById(
      "storeDiscount"
    )?.value || "";
  const websiteUrl =
    document.getElementById(
      "storeWebsite"
    )?.value || "";
  const storePassword =
    document.getElementById(
      "storePassword"
    )?.value || "";
  /*
    기본폼 지역 검증

    지역이 선택되어 있을 때만
    해당 지역 주소를 허용
  */
  if (
    currentCity &&
    !address.includes(
      currentCity
    )
  ) {
    alert(
      `현재 ${currentCity} 관리자 페이지에서는 ${currentCity} 매장만 등록할 수 있습니다.`
    );
    return;
  }
  const coords =
    await getCoordsFromAddress(
      address
    );
  if (!coords) {
    alert(
      "주소 좌표 변환 실패"
    );
    return;
  }
  fetch(
    GAS_URL +
    "?action=addStore" +
    "&storeName=" +
    encodeURIComponent(
      storeName
    ) +
    "&category=" +
    encodeURIComponent(
      category
    ) +
    "&dong=" +
    encodeURIComponent(
      dong
    ) +
    "&address=" +
    encodeURIComponent(
      address
    ) +
    "&phone=" +
    encodeURIComponent(
      phone
    ) +
    "&discount=" +
    encodeURIComponent(
      discount
    ) +
    "&websiteUrl=" +
    encodeURIComponent(
      websiteUrl
    ) +
    "&storePassword=" +
    encodeURIComponent(
      storePassword
    ) +
    "&lat=" +
    encodeURIComponent(
      coords.lat
    ) +
    "&lng=" +
    encodeURIComponent(
      coords.lng
    ) +
    "&status=" +
    encodeURIComponent(
      status
    )
  )
  .then(res =>
    res.json()
  )
  .then(data => {
    if (data.success) {
      showMsg(
        "등록 완료 ❤️"
      );
      loadStores();
    } else {
      alert(
        "등록 실패"
      );
    }
  })
  .catch(err => {
    console.error(err);
    alert(
      "등록 중 오류 발생"
    );
  });
}

/* =========================
   ⭐ 매장 삭제
========================= */

function deleteStore(id) {
  if (!requireAdmin()) return;

  if (    !confirm(
      "정말 삭제할까?"
    )
  ) return;
  fetch(
    GAS_URL +
    "?action=deleteStore&storeId=" +
    encodeURIComponent(
      id
    )
  )
  .then(res =>
    res.json()
  )
  .then(data => {
    if (data.success) {
      loadStores();
    } else {
      alert(
        "삭제 실패"
      );
    }
  })
  .catch(err => {
    console.error(err);
    alert(
      "삭제 중 오류 발생"
    );
  });
}

/* =========================
   ⭐ 매장 수정
========================= */

function editStore(id) {
  if (
    !requireStoreOwner(id)
  ) return;
  const store =
    allStores.find(
      s =>
        String(s.storeId) ===
        String(id)
    );
  if (!store) return;
  const newName =
    prompt(
      "매장명",
      store.storeName
    );
  const newAddress =
    prompt(
      "주소",
      store.address
    );
  const newPhone =
    prompt(
      "전화번호",
      store.phone
    );
  const newCategory =
    prompt(
      "카테고리",
      store.category
    );
  const newDiscount =
    prompt(
      "할인",
      store.discount
    );
  const newUrl =
    prompt(
      "웹사이트",
      store.websiteUrl
    );
  fetch(
    GAS_URL +
    "?action=updateStore" +
    "&storeId=" +
    encodeURIComponent(
      id
    ) +
    "&storeName=" +
    encodeURIComponent(
      newName
    ) +
    "&address=" +
    encodeURIComponent(
      newAddress
    ) +
    "&phone=" +
    encodeURIComponent(
      newPhone
    ) +
    "&category=" +
    encodeURIComponent(
      newCategory
    ) +
    "&discount=" +
    encodeURIComponent(
      newDiscount
    ) +
    "&websiteUrl=" +
    encodeURIComponent(
      newUrl
    )
  )
  .then(() =>
    loadStores()
  );
}

/* =========================
   🎁 이벤트 관리
========================= */

function editEvent(id) {
  const eventAdminPw =
    prompt(
      "🎁 이벤트 관리자 비밀번호"
    );
  if (
    eventAdminPw !==
    "132482"
  ) {
    alert(
      "이벤트 관리 권한 없음"
    );
    return;
  }
  const store =
    allStores.find(
      s =>
        String(s.storeId) ===
        String(id)
    );
  if (!store) return;
  const eventStart =
    prompt(
      "이벤트 시작일 (YYYY-MM-DD)",
      store.eventStart || ""
    );
  const eventEnd =
    prompt(
      "이벤트 종료일 (YYYY-MM-DD)",
      store.eventEnd || ""
    );
  const eventText =
    prompt(
      "이벤트 내용",
      store.eventText || ""
    );
  fetch(
    GAS_URL +
    "?action=updateStore" +
    "&storeId=" +
    encodeURIComponent(
      id
    ) +
    "&eventStart=" +
    encodeURIComponent(
      eventStart
    ) +
    "&eventEnd=" +
    encodeURIComponent(
      eventEnd
    ) +
    "&eventText=" +
    encodeURIComponent(
      eventText
    )
  )
  .then(res =>
    res.json()
  )
  .then(data => {
    if (data.success) {
      alert(
        "🎁 이벤트 등록 완료"
      );
      loadStores();
    } else {
      alert(
        "이벤트 등록 실패"
      );
    }
  })
  .catch(err => {
    console.error(err);
    alert(
      "이벤트 오류"
    );
  });
}

/* =========================
   ⭐ 쿠폰 상태 변경
========================= */

function payCoupon(id) {
  updateStatus(
    id,
    "paid"
  );
}
function updateStatus(
  id,
  status
) {
  fetch(
    GAS_URL +
    "?action=updateStatus" +
    "&couponId=" +
    encodeURIComponent(
      id
    ) +
    "&status=" +
    encodeURIComponent(
      status
    )
  )
  .then(() =>
    loadAdminCoupons()
  )
  .catch(err =>
    console.error(err)
  );
}

/* =========================
   ⭐ 쿠폰 삭제
========================= */

function deleteCoupon(id) {
  if (!requireAdmin()) return;
  if (
    !confirm(
      "정말 삭제할까?"
    )
  ) return;
  fetch(
    GAS_URL +
    "?action=deleteCoupon&couponId=" +
    encodeURIComponent(
      id
    )
  )
  .then(res =>
    res.json()
  )
  .then(data => {
    if (data.success) {
      loadAdminCoupons();
    } else {
      alert(
        "삭제 실패"
      );
    }
  })
  .catch(err => {
    console.error(err);
    alert(
      "삭제 중 오류 발생"
    );
  });
}

/* =========================
   ⭐ 매장 필터
========================= */

function updateStoreFilter() {
  const select =
    document.getElementById(
      "storeFilter"
    );
  if (!select) return;
  const current =
    select.value;
  select.innerHTML =
    `<option value="all">전체</option>` +
    allStores.map(s =>
      `<option value="${s.storeName}">
        ${s.storeName}
       </option>`
    ).join("");
  select.value =
    current;
}

/* =========================
   ⭐ 이벤트 필터
========================= */

function filterEventStores() {
  const el =
    document.getElementById(
      "storeList"
    );
  const eventStores =
    allStores.filter(
      s =>
        isEventActive(s)
    );
  if (!eventStores.length) {
    el.innerHTML =
      "이벤트 매장 없음";
    return;
  }
  el.innerHTML =
    eventStores.map(s => {
      return `
        <div class="card">
          <b>
            🏪 ${s.storeName}
          </b>
          <br>
          📍 ${
            s.address || "-"
          }
          <br>
          🎁 ${
            s.discount || "-"
          }
          <br>
          🔥 이벤트 진행중
        </div>
      `;
    }).join("");
}

/* =========================
   ⭐ 매장 검색
========================= */

function searchStore() {
  const keyword =
    document.getElementById(
      "storeSearch"
    ).value.trim();
  if (!keyword) {
    renderStores();
    return;
  }
  const filtered =
    allStores.filter(
      store =>
        (
          store.storeName || ""
        ).includes(keyword)
    );
  const el =
    document.getElementById(
      "storeList"
    );
  if (!filtered.length) {
    el.innerHTML =
      "검색 결과 없음";
    return;
  }
  el.innerHTML =
    filtered.map(s => {
      return `
        <div class="card">
          <b>
            🏪 ${s.storeName}
          </b>
          <br>
          📍 ${
            s.address || "-"
          }
          <br>
          📞 ${
            s.phone || "-"
          }
          <br>
          🎁 ${
            s.discount || "-"
          }
          <div class="status ${
            s.status === "active"
              ? "active"
              : "expired"
          }">
            ${
              s.status === "active"
                ? "운영중"
                : "등록대기"
            }
          </div>
          <br>
          <button
            onclick="editStore('${s.storeId}')">
            수정
          </button>
          <button
            onclick="editEvent('${s.storeId}')">
            🎁 이벤트 등록
          </button>
          <br>
          <button
            onclick="deleteStore('${s.storeId}')">
            삭제
          </button>
          <button
            onclick="setStoreStatus('${s.storeId}','active')">
            등록
          </button>
          <button
            onclick="setStoreStatus('${s.storeId}','pending')">
            등록대기
          </button>
        </div>
      `;
    }).join("");
}

/* =========================
   ⭐ 메시지
========================= */

function showMsg(text) {
  const msg =
    document.createElement(
      "div"
    );
  msg.innerText =
    text;
  msg.style.position =
    "fixed";
  msg.style.bottom =
    "20px";
  msg.style.left =
    "50%";
  msg.style.transform =
    "translateX(-50%)";
  msg.style.background =
    "#333";
  msg.style.color =
    "#fff";
  msg.style.padding =
    "10px 20px";
  msg.style.borderRadius =
    "8px";
  msg.style.zIndex =
    "9999";
  document.body.appendChild(
    msg
  );
  setTimeout(() => {
    msg.remove();
  }, 500);
}

/* =========================
   📢 티커 광고 목록 불러오기
========================= */

function loadTickerAdminList() {
  const el =
    document.getElementById(
      "tickerAdminList"
    );
  if (!el) return;
  el.innerHTML =
    "티커 광고 불러오는 중...";
  fetch(
    GAS_URL +
    "?action=getTickerAds" +
    "&city=" +
    encodeURIComponent(
      currentCity
    ),
    {
      cache: "no-store"
    }
  )
    .then(res =>
      res.json()
    )
    .then(data => {
      const ads =
        Array.isArray(data)
          ? data
          : data.data || [];
      if (!ads.length) {
        el.innerHTML =
          "등록된 티커 광고가 없습니다.";
        return;
      }
      el.innerHTML =
        ads.map(ad => `
          <div class="card">
            <b>
              📢 ${ad.text || ""}
            </b>
            <br>
            📍 ${
              ad.city ||
              currentCity
            }
            ${
              ad.dong
                ? `<br>🏠 ${ad.dong}`
                : ""
            }
            ${
              ad.url
                ? `<br>🔗 ${ad.url}`
                : ""
            }

                  <br>
                  <button
                   onclick="editTickerAd('${ad.adId}')">
                ✏️ 수정
              </button>

              <button
                class="btn-delete"
                onclick="deleteTickerAd('${ad.adId}')">
                🗑️ 삭제
              </button>
         </div>

        `).join("");
    })
    .catch(err => {
      console.error(
        "티커 광고 목록 로드 실패:",
        err
      );
      el.innerHTML =
        "티커 광고를 불러오지 못했습니다.";
    });
}

/* =========================
   📢 티커 광고 등록
========================= */

function addTickerAd() {
  if (!requireAdmin()) return;
  if (!currentCity) {
    alert(
      "현재 관리자 지역을 확인할 수 없습니다."
    );
    return;
  }
  const dong =
    document.getElementById(
      "tickerDong"
    )?.value.trim() || "";
  const text =
    document.getElementById(
      "tickerText"
    )?.value.trim() || "";
  const url =
    document.getElementById(
      "tickerUrl"
    )?.value.trim() || "";
  if (!text) {
    alert(
      "티커 광고 내용을 입력해주세요."
    );
    return;
  }
  fetch(
    GAS_URL +
    "?action=addTickerAd" +
    "&city=" +
    encodeURIComponent(
      currentCity
    ) +
    "&dong=" +
    encodeURIComponent(
      dong
    ) +
    "&text=" +
    encodeURIComponent(
      text
    ) +
    "&url=" +
    encodeURIComponent(
      url
    )
  )
    .then(res =>
      res.json()
    )
    .then(data => {
      if (data.success) {
        alert(
          "📢 티커 광고 등록 완료"
        );
        document.getElementById(
          "tickerDong"
        ).value = "";
        document.getElementById(
          "tickerText"
        ).value = "";
        document.getElementById(
          "tickerUrl"
        ).value = "";
        loadTickerAdminList();
      } else {
        alert(
          data.message ||
          "티커 광고 등록 실패"
        );
      }
    })
    .catch(err => {
      console.error(
        "티커 광고 등록 오류:",
        err
      );
      alert(
        "티커 광고 등록 중 오류가 발생했습니다."
      );
    });
}
/* =========================
   ⭐ 초기 실행
========================= */

window.addEventListener(
  "load",
  async () => {
    updateAdminButton();
    await loadStores();
    loadAdminCoupons();
    // 📢 현재 지역 티커 광고 목록 불러오기
    loadTickerAdminList();
    setInterval(
      () => {
        loadAdminCoupons();
      },
      60000
    );
  }
);

/* =========================
   ⭐ 필터 이벤트
========================= */

const storeFilter =
  document.getElementById(
    "storeFilter"
  );
if (storeFilter) {
  storeFilter.addEventListener(
    "change",
    e => {
      renderCoupons(
        e.target.value
      );
    }
  );
}

/* =========================
   📢 티커 광고 수정
========================= */

function editTickerAd(adId) {
  if (!requireAdmin()) return;

  const newDong =
    prompt(
      "동 이름 (선택사항)",
      ""
    );

  const newText =
    prompt(
      "티커 광고 내용",
      ""
    );

  const newUrl =
    prompt(
      "광고 클릭 URL (선택사항)",
      ""
    );

  if (!newText) {
    alert(
      "티커 광고 내용을 입력해주세요."
    );
    return;
  }

  fetch(
    GAS_URL +
    "?action=updateTickerAd" +
    "&adId=" +
    encodeURIComponent(adId) +
    "&city=" +
    encodeURIComponent(currentCity) +
    "&dong=" +
    encodeURIComponent(newDong || "") +
    "&text=" +
    encodeURIComponent(newText) +
    "&url=" +
    encodeURIComponent(newUrl || "")
  )
  .then(res =>
    res.json()
  )
  .then(data => {

    if (data.success) {

      alert(
        "📢 티커 광고 수정 완료"
      );

      loadTickerAdminList();

    } else {

      alert(
        data.message ||
        "티커 광고 수정 실패"
      );

    }

  })
  .catch(err => {

    console.error(
      "티커 광고 수정 오류:",
      err
    );

    alert(
      "티커 광고 수정 중 오류가 발생했습니다."
    );

  });
}

/* =========================
   📢 티커 광고 삭제
========================= */

function deleteTickerAd(adId) {

  if (!requireAdmin()) return;

  if (
    !confirm(
      "이 티커 광고를 정말 삭제할까요?"
    )
  ) {
    return;
  }

  fetch(
    GAS_URL +
    "?action=deleteTickerAd" +
    "&adId=" +
    encodeURIComponent(
      adId
    ),
    {
      cache: "no-store"
    }
  )
    .then(res =>
      res.json()
    )
    .then(data => {

      if (data.success) {

        alert(
          "🗑️ 티커 광고가 삭제되었습니다."
        );

        // 광고 목록 새로고침
        loadTickerAdminList();

      } else {

        alert(
          data.message ||
          "티커 광고 삭제 실패"
        );

      }

    })
    .catch(err => {

      console.error(
        "티커 광고 삭제 오류:",
        err
      );

      alert(
        "티커 광고 삭제 중 오류가 발생했습니다."
      );

    });

}