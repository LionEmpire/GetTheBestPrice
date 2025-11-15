import { callable } from '@steambrew/webkit';

declare const window: any;

// --- 1. CSS INJECTOR FUNCTION ---
function injectCSS() {
    // Only inject if the styles don't already exist
    if (document.getElementById('gtbp-styles')) return;

    const css = `
    #gtbp-price-widget {
        background-color: #1a2c3d;
        font-family: 'Tenorite', 'Motiva Sans', sans-serif;
        padding: 10px 16px;
        margin-bottom: 10px;
        border-radius: 3px;
        font-size: 14px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px 16px;
    }
    .gtbp-header {
        grid-column: 1 / -1; 
        color: #ffffff;
        font-size: 16px;
        padding-bottom: 6px;
        margin-bottom: 6px;
        border-bottom: 1px solid #2a475e;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .gtbp-header .header-title {
        font-weight: 700;
    }
    .gtbp-header a {
        color: #5d92b8;
        text-decoration: none;
        font-size: 12px;
        font-weight: 500;
    }
    .gtbp-header a:hover {
        color: #ffffff;
        text-decoration: underline;
    }
    .gtbp-price-row {
        display: flex;
        align-items: center;
        line-height: 1.4;
    }
    .gtbp-price-row .label {
        color: #5d92b8;
        font-weight: 500;
        min-width: 120px; 
        display: inline-block;
    }
    .gtbp-price-row .value {
        color: #ffffff;
        font-weight: 700;
        margin-left: 8px;
    }
    `;

    const styleElement = document.createElement('style');
    styleElement.id = 'gtbp-styles';
    styleElement.innerHTML = css;
    document.head.appendChild(styleElement);
}

// --- 2. Define Backend Function ---
type PriceData = {
	official_price: string;
	keyshop_price: string;
	historical_official: string;
    historical_keyshops: string;
	currency: string;
    url: string;
} | null;

const getGgDealsPrices = callable<[{ appId: string, regionCode: string }], string | null>(
	'get_ggdeals_prices',
);

// --- 3. UI Injector ---
function injectPriceUI(data: NonNullable<PriceData>) {
	const targetElement = document.getElementById('game_area_purchase');
    if (!targetElement) {
		console.error('[GetTheBestPrice] Could not find targetElement (#game_area_purchase) to inject UI.');
		return;
	}
	if (document.getElementById('gtbp-price-widget')) return;

	const createRow = (label: string, price: string, currency: string, cssClass: string) => {
		if (price === 'N/A') return '';
        const priceDisplay = `${price} ${currency}`; 
        return `
            <div class="gtbp-price-row ${cssClass}">
                <span class="label">${label}:</span>
                <span class="value">${priceDisplay}</span>
            </div>
        `;
	};

	const officialRow = createRow('Official', data.official_price, data.currency, 'official');
	const keyshopRow = createRow('Keyshop', data.keyshop_price, data.currency, 'keyshop');
    const historicalOfficialRow = createRow('Historical Official', data.historical_official, data.currency, 'hist-official');
    const historicalKeyshopRow = createRow('Historical Keyshop', data.historical_keyshops, data.currency, 'hist-keyshop');
    
    // This link is required by the GG.deals API Terms
    const linkRow = data.url ? `<a href="${data.url}" target="_blank">View on GG.deals</a>` : '';

	if (!officialRow && !keyshopRow && !historicalOfficialRow && !historicalKeyshopRow) {
		console.log('[GetTheBestPrice] No prices found to display.');
		return;
	}

	const newDiv = document.createElement('div');
	newDiv.id = 'gtbp-price-widget';
    newDiv.innerHTML = `
        <div class="gtbp-header">
            <span class="header-title">Prices by GG.deals</span>
            ${linkRow}
        </div>
        ${officialRow}
        ${historicalOfficialRow}
        ${keyshopRow}
        ${historicalKeyshopRow}
    `;

	targetElement.parentNode?.insertBefore(newDiv, targetElement);
	console.log('[GetTheBestPrice] Injected price UI.');
}

// --- 4. Main Function ---
async function RunPriceCheck(appId: string, countryCode: string) {
	try {
		const priceJsonString = await getGgDealsPrices({
            appId: appId,
            regionCode: countryCode.toLowerCase()
        }); 

		if (priceJsonString) {
            const priceData: PriceData = JSON.parse(priceJsonString);
			injectPriceUI(priceData);
		} else {
            console.log('[GetTheBestPrice] Backend returned null or empty string.');
        }
	} catch (e) {
		console.error('[GetTheBestPrice] Error calling backend or parsing JSON:', e);
	}
}

// --- 5. AppID Finder ---
function getAppID(): string | null {
    const url = window.location.href;
    const urlMatch = url.match(/\/app\/(\d+)/);
    if (urlMatch && urlMatch[1]) {
        return urlMatch[1];
    }
    return null;
}

// --- 6. Country Code Finder ---
function getCountryCode(): string | null {
    try {
        const appConfigElement = document.getElementById('application_config');
        if (appConfigElement && appConfigElement.dataset.config) {
            const configData = JSON.parse(appConfigElement.dataset.config);
            if (configData.COUNTRY) {
                return configData.COUNTRY;
            }
        }
        if (appConfigElement && appConfigElement.dataset.userinfo) {
            const userInfoData = JSON.parse(appConfigElement.dataset.userinfo);
            if (userInfoData.country_code) {
                return userInfoData.country_code;
            }
        }
    } catch (e) { /* Fail silently */ }
    
    const cookieMatch = document.cookie.match(/steamCountry=([A-Z]{2})/);
    if (cookieMatch && cookieMatch[1]) {
        return cookieMatch[1];
    }
    
    console.error("[GetTheBestPrice] All CountryCode finding methods failed.");
    return null;
}

// --- 7. "onPageLoad" function ---
function onPageLoad() {
    injectCSS();
    const appId = getAppID();
    const countryCode = getCountryCode();
    
    if (appId && countryCode) {
        RunPriceCheck(String(appId), String(countryCode));
    }
}

// --- 8. Entry point ---
export default async function WebkitMain() {
    // Only run on store app pages
    if (window.location.href.includes("/app/")) {
        if (document.readyState === 'complete') {
            onPageLoad();
        } else {
            window.addEventListener('load', onPageLoad);
        }
    }
}