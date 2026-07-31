const GAS_URL = "https://script.google.com/macros/s/AKfycbw551aqbI179VXkRTAmmLdsVnScywsUAS4J2tbdXZEXTMXwcGXtBVO5KYqDT0_TJlXR/exec";

// =========================
// 지역 정보
// =========================

const params = new URLSearchParams(window.location.search);

const storeName = params.get("name") || "";
const regionCode = params.get("region") || "";

let store = null;
let selectedType = "store";

console.log("📍 현재 지역 코드:", regionCode);
console.log("🏪 선택 매장:", storeName);


// =========================
// 매장 정보 로드
// =========================

async function loadStore() {
  try {
    const res = await fetch(
      GAS_URL + "?action=getStores"
    );
    const data = await res.json();
    const stores = Array.isArray(data)
      ? data
      : data.data || data.result || [];

    // =========================
    // 매장 찾기
    // =========================

    store = stores.find(s =>
      String(s.storeName || "").trim() ===
      String(storeName || "").trim()
    );
    if (!store) {
      alert("매장 정보를 찾을 수 없습니다.");
      throw new Error("store not found");
    }

    // =========================
    // 화면 표시
    // =========================

    document.getElementById("storeName").textContent =
      store.storeName || "-";
    document.getElementById("discount").textContent =
      store.discount || "-";

    // =========================
    // 쿠폰 로드
    // =========================

    loadCoupons();
  } catch (err) {
    console.error("매장 정보 로드 실패:", err);
  }
}

// =========================
// 홈페이지 열기
// =========================

function openHomepage() {
  if (!store) {
    alert("매장 정보를 불러오는 중입니다.");
    return;
  }
  if (store.websiteUrl) {
    window.open(
      store.websiteUrl,
      "_blank"
    );
  } else {
    alert("등록된 홈페이지가 없습니다.");
  }
}

// =========================
// 쿠폰 타입 선택
// =========================

function selectType(type) {
  selectedType = type;
  const addressInput =
    document.getElementById("address");
  if (type === "delivery") {
    addressInput.classList.remove("hidden");
    addressInput.required = true;
  } else {
    addressInput.classList.add("hidden");
    addressInput.required = false;
    addressInput.value = "";
  }
}

// =========================
// 쿠폰 발급
// =========================

document
  .getElementById("couponForm")
  .addEventListener("submit", function(e) {
    e.preventDefault();
    if (!store) {
      alert("매장 정보를 불러오는 중입니다.");
      return;
    }
    const name =
      document.getElementById("name")
        .value
        .trim();
    const phone =
      document.getElementById("phone")
        .value
        .trim();
    const address =
      document.getElementById("address")
        .value
        .trim();
    const now = Date.now();

    // =========================
    // 기존 쿠폰 확인
    // =========================

    fetch(
      GAS_URL +
      "?action=getCoupons"
    )
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data)
          ? data
          : data.data ||
            data.result ||
            [];
        console.log(
          "📦 쿠폰 목록 확인:",
          list
        );
        const hasActiveCoupon =
          list.some(c => {
            const issuedTime =
              new Date(c.issuedAt)
                .getTime();
            const isExpired =
              now - issuedTime >
              2 * 60 * 60 * 1000;
            return (
              String(c.storeName || "")
                .trim() ===
              String(store.storeName || "")
                .trim()
              &&
              normalizePhone(c.phone) ===
              normalizePhone(phone)
              &&
              c.status === "active"
              &&
              !isExpired
            );
          });
        if (hasActiveCoupon) {
          alert(
            "이미 사용 가능한 쿠폰이 있습니다."
          );
          return;
        }
        issueCoupon(
          name,
          phone,
          address
        );
      })
      .catch(err => {
        console.error(err);
        alert(
          "쿠폰 확인 실패"
        );
      });
  });

// =========================
// 실제 쿠폰 발급
// =========================

function issueCoupon(
  name,
  phone,
  address
) {
  fetch(
    GAS_URL +
    "?action=issueCoupon" +
    "&storeName=" +
    encodeURIComponent(
      store.storeName || ""
    ) +
    "&storeId=" +
    encodeURIComponent(
      store.storeId || ""
    ) +
    "&name=" +
    encodeURIComponent(name) +
    "&phone=" +
    encodeURIComponent(phone) +
    "&address=" +
    encodeURIComponent(address) +
    "&type=" +
    encodeURIComponent(
      selectedType
    )
  )
    .then(async res => {
      const text =
        await res.text();
      console.log(
        "RAW RESPONSE:",
        text
      );
      return JSON.parse(text);
    })
    .then(data => {
      console.log(
        "🎫 쿠폰 발급 완료:",
        data
      );
      alert(
        "쿠폰이 발급되었습니다!"
      );
      loadCoupons();
    })
    .catch(err => {
      console.error(err);
      alert(
        "쿠폰 발급 실패"
      );
    });
}

// =========================
// 쿠폰 불러오기
// =========================

function loadCoupons() {
  fetch(
    GAS_URL +
    "?action=getCoupons"
  )
    .then(res => res.json())
    .then(data => {
      const list =
        Array.isArray(data)
          ? data
          : data.data ||
            data.result ||
            [];
      // 현재 매장의 쿠폰만 표시
      const myCoupons =
        list.filter(coupon =>
          String(
            coupon.storeName || ""
          )
            .trim() ===
          String(
            store?.storeName || ""
          )
            .trim()
        );
      renderCoupons(
        myCoupons
      );
    })
    .catch(err => {
      console.error(
        "쿠폰 불러오기 실패:",
        err
      );
    });
}

// =========================
// 쿠폰 렌더
// =========================

function renderCoupons(coupons) {
  const listElement =
    document.getElementById(
      "couponList"
    );
  if (
    !coupons ||
    coupons.length === 0
  ) {
    listElement.innerHTML =
      "발급된 쿠폰이 없습니다.";
    return;
  }
  let html = "";
  const now =
    Date.now();
  coupons.forEach(c => {
    const issuedTime =
      new Date(
        c.issuedAt
      ).getTime();
    const isExpiredByTime =
      now - issuedTime >
      2 * 60 * 60 * 1000;
    const isActive =
      c.status === "active" &&
      !isExpiredByTime;
    html += `
      <div class="coupon-card">
        <div class="coupon-top">
          <span class="coupon-name">
            ${c.name || "이름 없음"}
          </span>
          <span class="coupon-status ${
            isActive
              ? "status-active"
              : "status-expired"
          }">
            ${
              isActive
                ? "🟢 사용가능"
                : "⚪ 결제완료"
            }
          </span>
        </div>
        <div class="coupon-info">
          🏪 ${
            c.storeName || "-"
          }
          <br>
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
      </div>
    `;
  });
  listElement.innerHTML =
    html;
}

// =========================
// 전화번호 정규화
// =========================

function normalizePhone(value) {
  return String(value || "")
    .replace(
      /[^0-9]/g,
      ""
    )
    .replace(
      /^0/,
      ""
    );
}

// =========================
// 페이지 시작
// =========================

window.addEventListener(
  "DOMContentLoaded",
  () => {
    loadStore();
  }
);