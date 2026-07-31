// ======================================================
// 우동폰 지역별 티커 광고
// GAS의 tickerAds 시트에서 광고를 자동으로 가져옴
// ======================================================

const TICKER_GAS_URL =
  "https://script.google.com/macros/s/AKfycbw551aqbI179VXkRTAmmLdsVnScywsUAS4J2tbdXZEXTMXwcGXtBVO5KYqDT0_TJlXR/exec";

let TICKER_ADS = [];

// ======================================================
// 1. 티커 DOM 가져오기
// ======================================================

function getTickerElements() {
  
  const cityTicker =
    document.getElementById(
      "cityTicker"
    );
  const dongTicker =
    document.getElementById(
      "dongTicker"
    );
  return {
    cityTicker,
    dongTicker
  };
}

// ======================================================
// 2. GAS 티커 광고 불러오기
// ======================================================

async function loadTickerAds() {
  try {

    // --------------------------------------------------
    // 현재 시·군
    // --------------------------------------------------

    const city =
      typeof currentRegion !== "undefined" &&
      currentRegion
        ? String(
            currentRegion.name || ""
          ).trim()
        : "";

    // --------------------------------------------------
    // 현재 동
    // --------------------------------------------------

    const dong =
      typeof currentDong !== "undefined"
        ? String(
            currentDong || ""
          ).trim()
        : "";

    // --------------------------------------------------
    // 티커 영역
    // --------------------------------------------------

    const {
      cityTicker,
      dongTicker
    } = getTickerElements();

    // --------------------------------------------------
    // 지역이 선택되지 않은 경우
    // 두 티커 모두 숨김
    // --------------------------------------------------

    if (!city) {
  if (cityTicker) {
    cityTicker.innerHTML =
      '<div class="ticker-item">📢 해당 시·군 전역 광고 창입니다. 광고를 등록해 보세요~ ^^</div>';
  }
  if (dongTicker) {
    dongTicker.innerHTML =
      '<div class="ticker-item">📢 해당 지역 읍·면·동 광고 창입니다. 광고를 등록해 보세요~ ^^</div>';
  }
  TICKER_ADS = [];
  return;
}

    // --------------------------------------------------
    // GAS 요청
    // --------------------------------------------------

    const params =
      new URLSearchParams({
        action:
          "getTickerAds",
        city:
          city,
        dong:
          dong
      });

    const res =
      await fetch(
        TICKER_GAS_URL +
        "?" +
        params.toString(),
        {
          cache:
            "no-store"
        }
      );

    const data =
      await res.json();

    // --------------------------------------------------
    // 광고 데이터 저장
    // --------------------------------------------------

    TICKER_ADS =
      Array.isArray(data)
        ? data
        : [];

    console.log(
      "📢 현재 지역 티커 광고:",
      city,
      dong,
      TICKER_ADS
    );

    // --------------------------------------------------
    // 티커 출력
    // --------------------------------------------------

    initTicker();
  } catch (err) {
    console.error(
      "티커 광고 로드 실패:",
      err
    );

    TICKER_ADS = [];

    // 오류 발생 시
    // 두 티커 모두 비우기
    const {
      cityTicker,
      dongTicker
    } = getTickerElements();

    if (cityTicker) {
      cityTicker.innerHTML = "";
    }
    if (dongTicker) {
      dongTicker.innerHTML = "";
    }
  }
}

// ======================================================
// 3. 티커 초기화
// ======================================================

function initTicker() {

  // ----------------------------------------------------
  // 티커 영역 가져오기
  // ----------------------------------------------------

  const {
    cityTicker,
    dongTicker
  } = getTickerElements();

  // ----------------------------------------------------
  // 현재 시·군
  // ----------------------------------------------------

  const city =
    typeof currentRegion !== "undefined" &&
    currentRegion
      ? String(
          currentRegion.name || ""
        ).trim()
      : "";

  // ----------------------------------------------------
  // 현재 동
  // ----------------------------------------------------

  const currentDongValue =
    typeof currentDong !== "undefined"
      ? String(
          currentDong || ""
        ).trim()
      : "";

  // ----------------------------------------------------
  // 지역이 선택되지 않은 경우
  // ----------------------------------------------------

  if (!city) {
    if (cityTicker) {
      cityTicker.innerHTML = "";
    }
    if (dongTicker) {
      dongTicker.innerHTML = "";
    }
    return;
  }

  // ====================================================
  // 4. 현재 시·군 광고 찾기
  // ====================================================

  const cityAds =
    TICKER_ADS.filter(
      ad => {
        const adCity =
          String(
            ad.city || ""
          ).trim();

        return (
          adCity === city
        );
      }
    );

  // ====================================================
  // 5. 시·군 전체 광고
  //
  // city는 같고
  // dong이 비어있는 광고
  // ====================================================

  const cityWideAds =
    cityAds.filter(
      ad => {
        const adDong =
          String(
            ad.dong || ""
          ).trim();

        return !adDong;
      }
    );

  // ====================================================
  // 6. 현재 동 광고
  //
  // 현재 동이 선택된 경우만 검색
  // ====================================================

  let dongAds = [];

  if (
    currentDongValue &&
    currentDongValue !==
      "전체"
  ) {

    const normalizedDong =
      normalizeDong(
        currentDongValue
      );

    dongAds =
      cityAds.filter(
        ad => {
          const adDong =
            String(
              ad.dong || ""
            ).trim();

          if (!adDong) {
            return false;
          }

          return (
            normalizeDong(
              adDong
            ) ===
            normalizedDong
          );
        }
      );
  }

  // ====================================================
  // 7. 시·군 티커 출력
  //
  // 시·군 전체 광고만 표시
  // ====================================================

  renderTicker(
    cityTicker,
    cityWideAds
  );

  // ====================================================
  // 8. 동 티커 출력
  //
  // 동을 선택했을 때
  // 해당 동 광고만 표시
  // ====================================================

  if (
    currentDongValue &&
    currentDongValue !==
      "전체"

  ) {

    renderTicker(
      dongTicker,
      dongAds
    );

  } else {

    // 동을 선택하지 않았으면
    // 동 광고 숨김
    if (dongTicker) {
      dongTicker.innerHTML = "";
    }
  }
}


// ======================================================
// 9. 티커 HTML 생성
// ======================================================

function renderTicker(
  ticker,
  ads
) {

  // ----------------------------------------------------
  // 티커 영역이 없으면 종료
  // ----------------------------------------------------

  if (!ticker) {
    console.log(
      "티커 영역을 찾을 수 없습니다."
    );
    return;
  }

  // ----------------------------------------------------
  // 광고가 없으면 숨김
  // ----------------------------------------------------

  if (
    !ads ||
    !ads.length
  ) {
    ticker.innerHTML = "";
    return;
  }

  // ====================================================
  // 광고 HTML 생성
  // ====================================================

  const tickerItems =
    ads.map(
      ad => {
        const text =
          String(
            ad.text || ""
          ).trim();

        // 광고 문구가 없으면 제외
        if (!text) {
          return "";
        }

        // ------------------------------------------------
        // URL이 있는 광고
        // ------------------------------------------------

        if (ad.url) {
          const safeUrl =
            String(
              ad.url
            ).replace(
              /'/g,
              "\\'"
            );

          return `
            <span
              class="ticker-item ticker-link"
              onclick="
                window.open(
                  '${safeUrl}',
                  '_blank'
                )
              "
            >
              ${text}
            </span>
          `;
        }

        // ------------------------------------------------
        // URL이 없는 광고
        // ------------------------------------------------

        return `
          <span
            class="ticker-item"
          >
            ${text}
          </span>
        `;
      }
    )

    .filter(
      item => item
    )

    .join(
      `<span class="ticker-separator">
        ◆
      </span>`
    );

  // ====================================================
  // 실제 티커 출력
  //
  // 광고를 2번 반복하여
  // 계속 이어지는 것처럼 보이게 함
  // ====================================================

  ticker.innerHTML = `
    <div
      class="ticker-track"
    >
      ${tickerItems}
      <span
        class="ticker-separator"
      >
        ◆
      </span>
      ${tickerItems}
    </div>
  `;
}


// ======================================================
// 10. 티커 강제 갱신
// ======================================================

function refreshTicker() {
  initTicker();
}

// ======================================================
// 11. 지역 변경 시 티커 갱신
// ======================================================

function updateTickerByRegion() {
  setTimeout(
    () => {
      loadTickerAds();
    },
    100
  );
}

// ======================================================
// 12. DOM 로드
// ======================================================

window.addEventListener(
  "DOMContentLoaded",
  function() {
    setTimeout(
      () => {
        loadTickerAds();
      },
      300
    );
  }
);