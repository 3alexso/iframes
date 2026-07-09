// Exposed as window.runWalkmeSwtTest instead of auto-running, so a host page (e.g. auto.html)
// can start it on a button click rather than the moment this script loads.
window.runWalkmeSwtTest = async function walkmeSwtTest() {
	// ---------------------------------------------------------------------
	// CONFIG_BY_ENV — edit these before running. Every value tagged "Editable data" is
	// account/SWT-specific and needs to be filled in per environment before you pick it
	// at the prompt below. Selectors that are code-level constants (not account data) live
	// in SELECTORS instead, shared across every environment/mode.
	// ---------------------------------------------------------------------
	const MODES = ['AI Action Bar', 'NO AI Action Bar'];

	const CONFIG_BY_ENV = {
		US: {
			aiActionBar: {
				snippetUrl: 'https://cdn.walkme.com/users/9a345b0fa50e4f5396ede47f241d05df/test/walkme_9a345b0fa50e4f5396ede47f241d05df_https.js'
			},
			noAiActionBar: {
				snippetUrl: 'https://cdn.walkme.com/users/8b982176173a47f7a79459d1a6c3a0e0/test/walkme_8b982176173a47f7a79459d1a6c3a0e0_https.js',
				launcherId: '1020643'
			}
		},
		EU: {
			aiActionBar: { snippetUrl: 'https://eu-cdn.walkme.com/users/1e7db03a0db44069a8973a35d623694b/test/walkme_1e7db03a0db44069a8973a35d623694b_https.js' },
			noAiActionBar: { snippetUrl: 'https://eu-cdn.walkme.com/users/72bf67c6a9ed4d8fa83a6d71d55eb42f/test/walkme_72bf67c6a9ed4d8fa83a6d71d55eb42f_https.js', launcherId: '1000113013' }
		},
		'Canada (prod2)': {
			aiActionBar: { snippetUrl: 'REPLACE_WITH_CANADA_AI_SNIPPET_URL' },
			noAiActionBar: { snippetUrl: 'REPLACE_WITH_CANADA_NON_AI_SNIPPET_URL', launcherId: 'REPLACE_WITH_CANADA_NON_AI_LAUNCHER_ID' }
		},
		'Fedramp (prod2)': {
			aiActionBar: { snippetUrl: 'REPLACE_WITH_FEDRAMP_AI_SNIPPET_URL' },
			noAiActionBar: { snippetUrl: 'https://cdn.walkmegov.com/users/430d9ab7a46d425492af84f6de798f13/test/walkme_430d9ab7a46d425492af84f6de798f13_https.js', launcherId: '198072' }
		},
		'SAP US (us01)': {
			aiActionBar: { snippetUrl: 'REPLACE_WITH_SAP_US_AI_SNIPPET_URL' },
			noAiActionBar: { snippetUrl: 'REPLACE_WITH_SAP_US_NON_AI_SNIPPET_URL', launcherId: 'REPLACE_WITH_SAP_US_NON_AI_LAUNCHER_ID' }
		},
		'SAP EU (eu01)': {
			aiActionBar: { snippetUrl: 'REPLACE_WITH_SAP_EU_AI_SNIPPET_URL' },
			noAiActionBar: { snippetUrl: 'REPLACE_WITH_SAP_EU_NON_AI_SNIPPET_URL', launcherId: 'REPLACE_WITH_SAP_EU_NON_AI_LAUNCHER_ID' }
		},
		'GSA1 (t01)': {
			aiActionBar: { snippetUrl: 'REPLACE_WITH_GSA1_AI_SNIPPET_URL' },
			noAiActionBar: { snippetUrl: 'https://cdn.t01.walkmegov.com/users/e1ef054f22c944ebb24ac97a092d32d2/test/walkme_e1ef054f22c944ebb24ac97a092d32d2_https.js', launcherId: '535' }
		},
		'GSA2 (t02)': {
			aiActionBar: { snippetUrl: 'REPLACE_WITH_GSA2_AI_SNIPPET_URL' },
			noAiActionBar: { snippetUrl: 'REPLACE_WITH_GSA2_NON_AI_SNIPPET_URL', launcherId: 'REPLACE_WITH_GSA2_NON_AI_LAUNCHER_ID' }
		}
	};

	// Derived from CONFIG_BY_ENV's keys directly so this list can't drift out of sync when
	// environments are added, removed, or renamed above.
	const ENVIRONMENTS = Object.keys(CONFIG_BY_ENV);

	const SELECTORS = {
		outputSelector: '.walkme-copilot-content-text.walkme-copilot-non-draggable',
		balloonSelector: '.walkme-custom-balloon-outer-div',
		balloonCloseButtonSelector: '.walkme-custom-balloon-close-button',
		quickActionWrapperSelector: '.assistive-writing-wrapper',
		quickActionTextInputSelector: '#walkme-copilot-text-input',
		quickActionGenerateButtonSelector: '.walkme-copilot-generate-button'
	};

	// Text typed into the "Run a quick action" input for the AI Action Bar flow.
	const QUICK_ACTION_TEXT = 'Summarize All';

	const TIMEOUTS = {
		player: 30000,
		menu: 10000,
		aiResponse: 20000,
		balloonOpen: 10000,
		quickAction: 15000
	};

	// How long to leave the menu open before closing it again in the menu-triggered flow.
	const MENU_OPEN_DURATION = 4000;

	// How long to leave the SWT balloon open before closing it in the NO AI Action Bar flow.
	const BALLOON_OPEN_DURATION = 4000;

	// ---------------------------------------------------------------------
	// Helpers
	// ---------------------------------------------------------------------
	const log = (...a) => console.log('%c[WM-TEST]', 'color:#00b894;font-weight:bold', ...a);
	const warn = (...a) => console.warn('%c[WM-TEST]', 'color:#e17055;font-weight:bold', ...a);

	// Editable config values are seeded with 'REPLACE_WITH_...' placeholders — treat anything
	// still carrying that prefix (or non-string) as "not filled in yet".
	function isPlaceholder(value) {
		return typeof value !== 'string' || value.startsWith('REPLACE_WITH_');
	}

	function getModeConfigKey(mode) {
		return mode === 'AI Action Bar' ? 'aiActionBar' : 'noAiActionBar';
	}

	// Snippet URLs look like https://cdn.walkme.com/users/{guid}/{env}/walkme_{guid}_https.js —
	// pull the account guid and the url's env segment (e.g. "test") back out of that shape.
	function parseSnippetUrl(url) {
		if (isPlaceholder(url)) return { guid: undefined, urlEnv: undefined };
		const match = url.match(/\/users\/([^/]+)\/([^/]+)\//);
		return { guid: match?.[1], urlEnv: match?.[2] };
	}

	// Builds a labeled group of radio buttons under `name`, greying out (disabling) any option
	// in `disabledOptions`. The first non-disabled option is checked by default.
	function buildRadioGroup(title, options, name, disabledOptions = []) {
		const wrapper = document.createElement('div');
		wrapper.style.marginBottom = '16px';

		const heading = document.createElement('div');
		heading.textContent = title;
		heading.style.fontWeight = 'bold';
		heading.style.marginBottom = '8px';
		wrapper.appendChild(heading);

		const firstEnabledIndex = options.findIndex(o => !disabledOptions.includes(o));

		options.forEach((opt, i) => {
			const isDisabled = disabledOptions.includes(opt);

			const label = document.createElement('label');
			label.style.display = 'block';
			label.style.marginBottom = '4px';
			label.style.cursor = isDisabled ? 'not-allowed' : 'pointer';
			label.style.opacity = isDisabled ? '0.4' : '1';

			const input = document.createElement('input');
			input.type = 'radio';
			input.name = name;
			input.value = opt;
			input.disabled = isDisabled;
			if (i === firstEnabledIndex) input.checked = true;

			label.append(input, ' ' + opt);
			wrapper.appendChild(label);
		});

		return wrapper;
	}

	// Re-applies disabled/greyed-out state to an already-built radio group (used when the mode
	// options need to change based on which environment is currently selected). If the
	// currently-checked option becomes disabled, checks the first still-enabled option instead.
	function updateRadioGroupDisabled(groupEl, name, disabledOptions) {
		const inputs = Array.from(groupEl.querySelectorAll(`input[name="${name}"]`));
		inputs.forEach(input => {
			const isDisabled = disabledOptions.includes(input.value);
			input.disabled = isDisabled;
			const label = input.closest('label');
			label.style.cursor = isDisabled ? 'not-allowed' : 'pointer';
			label.style.opacity = isDisabled ? '0.4' : '1';
		});

		const checked = inputs.find(input => input.checked);
		if (!checked || checked.disabled) {
			const firstEnabled = inputs.find(input => !input.disabled);
			if (firstEnabled) firstEnabled.checked = true;
		}
	}

	// Injects a modal with radio button groups for environment + mode; resolves with the
	// selected values once "Start Test" is clicked, rejects if "Cancel" is clicked. Environments
	// with no snippet configured for either mode are greyed out and can't be selected.
	function promptSelection(environments, modes, configByEnv) {
		return new Promise((resolve, reject) => {
			const disabledEnvironments = environments.filter(
				env => isPlaceholder(configByEnv[env].aiActionBar.snippetUrl) && isPlaceholder(configByEnv[env].noAiActionBar.snippetUrl)
			);
			const overlay = document.createElement('div');
			overlay.id = 'wm-test-selection-overlay';
			Object.assign(overlay.style, {
				position: 'fixed',
				inset: '0',
				background: 'rgba(0,0,0,0.5)',
				zIndex: '2147483647',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				fontFamily: 'sans-serif',
				fontSize: '14px'
			});

			const modal = document.createElement('div');
			Object.assign(modal.style, {
				background: '#fff',
				color: '#000',
				padding: '24px',
				borderRadius: '8px',
				minWidth: '280px',
				maxWidth: '90vw',
				boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
			});

			const envGroup = buildRadioGroup('Environment', environments, 'wm-test-env', disabledEnvironments);
			const modeGroup = buildRadioGroup('Action Bar mode', modes, 'wm-test-mode');

			// Which modes are selectable depends on which environment is picked — a mode with only
			// a placeholder snippet for the current environment gets greyed out too.
			function refreshModeDisabling() {
				const selectedEnv = envGroup.querySelector('input[name="wm-test-env"]:checked')?.value;
				const disabledModes = selectedEnv
					? modes.filter(m => isPlaceholder(configByEnv[selectedEnv][getModeConfigKey(m)].snippetUrl))
					: modes;
				updateRadioGroupDisabled(modeGroup, 'wm-test-mode', disabledModes);
			}

			const guidSection = document.createElement('div');
			guidSection.style.marginBottom = '16px';

			const guidHeading = document.createElement('div');
			guidHeading.textContent = 'System Guid';
			guidHeading.style.fontWeight = 'bold';
			guidHeading.style.marginBottom = '8px';
			guidSection.appendChild(guidHeading);

			const guidValue = document.createElement('div');
			const envValue = document.createElement('div');
			guidSection.append(guidValue, envValue);

			// Read-only info for the currently selected env/mode — pulled from the snippet url
			// itself rather than typed separately, so it can't drift out of sync with CONFIG_BY_ENV.
			function refreshGuidInfo() {
				const selectedEnv = envGroup.querySelector('input[name="wm-test-env"]:checked')?.value;
				const selectedMode = modeGroup.querySelector('input[name="wm-test-mode"]:checked')?.value;
				const { guid, urlEnv } =
					selectedEnv && selectedMode
						? parseSnippetUrl(configByEnv[selectedEnv][getModeConfigKey(selectedMode)].snippetUrl)
						: {};
				guidValue.textContent = `Guid: ${guid || '—'}`;
				envValue.textContent = `Env: ${urlEnv || '—'}`;
			}

			refreshModeDisabling();
			refreshGuidInfo();
			envGroup.addEventListener('change', () => {
				refreshModeDisabling();
				refreshGuidInfo();
			});
			modeGroup.addEventListener('change', refreshGuidInfo);

			const buttonRow = document.createElement('div');
			buttonRow.style.display = 'flex';
			buttonRow.style.gap = '8px';
			buttonRow.style.justifyContent = 'flex-end';

			const cancelBtn = document.createElement('button');
			cancelBtn.textContent = 'Cancel';
			cancelBtn.style.padding = '6px 12px';

			const submitBtn = document.createElement('button');
			submitBtn.textContent = 'Start Test';
			submitBtn.style.padding = '6px 12px';

			buttonRow.append(cancelBtn, submitBtn);
			modal.append(envGroup, modeGroup, guidSection, buttonRow);
			overlay.append(modal);
			document.body.append(overlay);

			cancelBtn.addEventListener('click', () => {
				overlay.remove();
				reject(new Error('Cancelled by user'));
			});

			submitBtn.addEventListener('click', () => {
				const env = modal.querySelector('input[name="wm-test-env"]:checked')?.value;
				const mode = modal.querySelector('input[name="wm-test-mode"]:checked')?.value;
				if (!env || !mode) {
					alert('No snippet is configured yet for that selection — fill in CONFIG_BY_ENV first.');
					return;
				}
				overlay.remove();
				resolve({ env, mode });
			});
		});
	}

	function waitFor(predicate, description, timeoutMs) {
		return new Promise((resolve, reject) => {
			const start = performance.now();
			(function poll() {
				let value;
				try {
					value = predicate();
				} catch (e) {
					value = false;
				}
				if (value) return resolve(value);
				if (performance.now() - start > timeoutMs) {
					return reject(new Error(`Timed out (${timeoutMs}ms) waiting for: ${description}`));
				}
				setTimeout(poll, 200);
			})();
		});
	}

	// Reads the running lib build version off WalkMeInfo (registered from lib.LibVersion in
	// player/lib/main.js — see getLibVersion in player/lib/walkMeInfo.js).
	function getLibVersion() {
		try {
			return window._walkmeInternals.ctx.get('WalkMeInfo').getLibVersion();
		} catch (e) {
			return undefined;
		}
	}

	// The SiteConfig JSON is the first data file the player loads after the snippet runs
	// (fetched by the config loader, then handed to SiteConfigManager.set() — see
	// components/core/dirtyDeps/siteConfigManager.ts). Reading it back via ctx gives us the
	// parsed object directly rather than trying to intercept the network request.
	function getSiteConfig() {
		try {
			return window._walkmeInternals.ctx.get('SiteConfigManager').get();
		} catch (e) {
			return undefined;
		}
	}

	// Checks the loaded SiteConfig: Player should be "Copilot" for both modes; AI Action Bar
	// mode additionally requires Settings.actionBarWidgetSettings.aiEnabled === "True" (see
	// isAiEnabled in components/packages/services/copilot/src/utils/common.ts).
	function checkSiteConfig(mode) {
		const siteConfig = getSiteConfig();
		const result = {
			playerField: siteConfig?.Player,
			playerIsCopilot: siteConfig?.Player === 'Copilot'
		};
		if (mode === 'AI Action Bar') {
			result.aiEnabledField = siteConfig?.Settings?.actionBarWidgetSettings?.aiEnabled;
			result.aiEnabledConfirmed = result.aiEnabledField === 'True';
		}
		return result;
	}

	function sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	function isVisible(selector) {
		const el = wmjQuery(selector);
		return el.length > 0 && el.is(':visible');
	}

	// Dumps every element whose id/class looks player-, menu-, or copilot-related, so we can see
	// what actually rendered when the expected selector doesn't show up.
	function dumpWalkmeDiagnostics() {
		const nodes = document.querySelectorAll('[id*="walkme"], [class*="walkme-player"], [class*="walkme-menu"], [class*="walkme-copilot"]');
		const rows = Array.from(nodes)
			.slice(0, 40)
			.map(el => ({
				tag: el.tagName,
				id: el.id,
				className: typeof el.className === 'string' ? el.className : '',
				visible: isVisible(el.id ? '#' + CSS.escape(el.id) : el)
			}));
		console.table(rows);
	}

	// toggleMenu() is a true toggle (backed by loadMenu(), which lazy-loads the menu bundle the
	// first time it's called) — calling it twice is NOT a safe "retry": if the first call's menu
	// bundle is still loading when we give up waiting and call toggleMenu() again, both calls'
	// pending opens can resolve back-to-back and cancel each other out, closing a menu that was
	// about to open. So: call it once, and just wait — don't re-toggle.
	async function openMenuViaToggle(timeoutMs) {
		if (isVisible('#walkme-menu') || window.WalkMePlayerAPI?.isMenuOpen?.()) return;

		if (!window.WalkMePlayerAPI?.toggleMenu) {
			throw new Error('window.WalkMePlayerAPI.toggleMenu is not available');
		}

		window.WalkMePlayerAPI.toggleMenu();
		try {
			await waitFor(
				() => isVisible('#walkme-menu') || window.WalkMePlayerAPI.isMenuOpen(),
				'menu open (toggleMenu call)',
				timeoutMs
			);
		} catch (e) {
			warn('Menu did not open — dumping WalkMe DOM diagnostics:');
			dumpWalkmeDiagnostics();
			throw e;
		}
	}

	// Closing is a plain toggleMenu() call too — safe here because the open has already fully
	// resolved (isMenuOpen() is true, no pending load), which is exactly the case the warning
	// above says NOT to worry about.
	async function closeMenuViaToggle(timeoutMs) {
		if (!isVisible('#walkme-menu') && !window.WalkMePlayerAPI?.isMenuOpen?.()) return;

		if (!window.WalkMePlayerAPI?.toggleMenu) {
			throw new Error('window.WalkMePlayerAPI.toggleMenu is not available');
		}

		window.WalkMePlayerAPI.toggleMenu();
		try {
			await waitFor(
				() => !isVisible('#walkme-menu') && !window.WalkMePlayerAPI.isMenuOpen(),
				'menu closed (toggleMenu call)',
				timeoutMs
			);
		} catch (e) {
			warn('Menu did not close — dumping WalkMe DOM diagnostics:');
			dumpWalkmeDiagnostics();
			throw e;
		}
	}

	function injectSnippet(url) {
		if (document.getElementById('wm-manual-test-script')) {
			log('Snippet script tag already present, skipping injection.');
			return;
		}
		window._walkmeConfig = { smartLoad: true };
		const script = document.createElement('script');
		script.id = 'wm-manual-test-script';
		script.type = 'text/javascript';
		script.async = true;
		script.src = url;
		const first = document.getElementsByTagName('script')[0];
		first.parentNode.insertBefore(script, first);
	}

	// ---------------------------------------------------------------------
	// Shared: WalkMePlayerAPI.toggleMenu() opens the menu
	//
	// The Workstation pro menu renders as a genuinely cross-origin app (a nested iframe served
	// from cdn.walkme.com/ws/app/...). The Same-Origin Policy makes its DOM unreachable from
	// page-injected JS (contentDocument is null) — there is no selector/timing fix for that, so
	// this only verifies the menu opens. Finding/clicking a specific SWT by name inside it would
	// need real OS-level input (e.g. Playwright/Selenium), not a devtools console script.
	// ---------------------------------------------------------------------
	async function runMenuTriggeredFlow() {
		log('--- Menu test: WalkMePlayerAPI.toggleMenu() ---');
		const result = { menuOpened: false, menuClosed: false };

		try {
			await waitFor(() => isVisible('#walkme-player'), 'player visible', TIMEOUTS.menu).catch(() => {
				warn('#walkme-player not visible before menu test — attempting toggleMenu() anyway');
			});

			await openMenuViaToggle(TIMEOUTS.menu);
			log('✅ Menu opened');
			result.menuOpened = true;
		} catch (e) {
			warn('❌ Menu-triggered flow failed:', e.message);
			return result;
		}

		log(`Leaving menu open for ${MENU_OPEN_DURATION}ms before closing...`);
		await sleep(MENU_OPEN_DURATION);

		try {
			await closeMenuViaToggle(TIMEOUTS.menu);
			log('✅ Menu closed');
			result.menuClosed = true;
		} catch (e) {
			warn('❌ Menu did not close:', e.message);
		}

		return result;
	}

	// ---------------------------------------------------------------------
	// Trigger the action bar launcher by ID via the public WalkMeAPI — shared trigger for both
	// AI Action Bar and NO AI Action Bar modes. What differs between modes is only the
	// completion check below.
	// ---------------------------------------------------------------------
	async function triggerLauncherById(launcherId) {
		const result = { launcherTriggered: false };

		if (!window.WalkMeAPI?.walkmex?.launchers?.triggerById) {
			warn('WalkMeAPI.walkmex.launchers.triggerById is not available — dumping WalkMe DOM diagnostics:');
			dumpWalkmeDiagnostics();
			throw new Error('window.WalkMeAPI.walkmex.launchers.triggerById is not available');
		}

		window.WalkMeAPI.walkmex.launchers.triggerById(launcherId);
		log(`Triggered launcher by id "${launcherId}"`);
		result.launcherTriggered = true;
		return result;
	}

	// ---------------------------------------------------------------------
	// AI Action Bar mode: click "Run a quick action" (present for every snippet, no launcher id
	// needed), type the quick action text into its input, then check the AI output text.
	// ---------------------------------------------------------------------
	async function triggerAiQuickAction(text) {
		const result = { quickActionOpened: false, textEntered: false, generateClicked: false };

		const wrapperEl = await waitFor(
			() => isVisible(SELECTORS.quickActionWrapperSelector) && wmjQuery(SELECTORS.quickActionWrapperSelector).get(0),
			'AI quick action wrapper (.assistive-writing-wrapper) visible',
			TIMEOUTS.quickAction
		).catch(e => {
			warn('Quick action wrapper not found — dumping WalkMe DOM diagnostics:');
			dumpWalkmeDiagnostics();
			throw e;
		});

		wrapperEl.click();
		log('Clicked AI quick action wrapper');
		result.quickActionOpened = true;

		const inputEl = await waitFor(
			() => isVisible(SELECTORS.quickActionTextInputSelector) && document.querySelector(SELECTORS.quickActionTextInputSelector),
			'AI quick action text input (#walkme-copilot-text-input) visible',
			TIMEOUTS.quickAction
		).catch(e => {
			warn('Quick action text input not found — dumping WalkMe DOM diagnostics:');
			dumpWalkmeDiagnostics();
			throw e;
		});

		inputEl.focus();
		if ('value' in inputEl) {
			inputEl.value = text;
		} else {
			inputEl.textContent = text;
		}
		inputEl.dispatchEvent(new Event('input', { bubbles: true }));
		log(`Entered quick action text "${text}"`);
		result.textEntered = true;

		const generateBtn = await waitFor(
			() => isVisible(SELECTORS.quickActionGenerateButtonSelector) && document.querySelector(SELECTORS.quickActionGenerateButtonSelector),
			'AI quick action generate button (.walkme-copilot-generate-button) visible',
			TIMEOUTS.quickAction
		).catch(e => {
			warn('Generate button not found — dumping WalkMe DOM diagnostics:');
			dumpWalkmeDiagnostics();
			throw e;
		});

		generateBtn.click();
		log('Clicked AI quick action generate button');
		result.generateClicked = true;

		return result;
	}

	async function runAiActionBarFlow() {
		log(`--- AI Action Bar test: run quick action "${QUICK_ACTION_TEXT}" ---`);
		const result = { quickActionOpened: false, textEntered: false, generateClicked: false, aiResponseReceived: false };

		try {
			Object.assign(result, await triggerAiQuickAction(QUICK_ACTION_TEXT));
		} catch (e) {
			warn('❌ Could not open quick action / enter text / click generate:', e.message);
			return result;
		}

		try {
			await waitFor(
				() => isVisible(SELECTORS.outputSelector) && wmjQuery(SELECTORS.outputSelector).first().text().trim().length > 0,
				'AI output text visible',
				TIMEOUTS.aiResponse
			);
			const text = wmjQuery(SELECTORS.outputSelector).first().text().trim();
			log('✅ AI response text found:', text);
			result.aiResponseReceived = true;
			result.aiResponseText = text;
		} catch (e) {
			warn('❌ No AI response text found in output element:', e.message);
		}

		return result;
	}

	// ---------------------------------------------------------------------
	// NO AI Action Bar mode: trigger the launcher, then check its SWT balloon opens.
	// ---------------------------------------------------------------------
	async function runNoAiActionBarFlow({ launcherId }) {
		log(`--- NO AI Action Bar test: trigger action bar launcher id "${launcherId}" ---`);
		const result = { launcherTriggered: false, balloonOpened: false, balloonClosed: false };

		try {
			Object.assign(result, await triggerLauncherById(launcherId));
		} catch (e) {
			warn('❌ Could not trigger launcher:', e.message);
			return result;
		}

		try {
			await waitFor(() => isVisible(SELECTORS.balloonSelector), 'SWT balloon visible', TIMEOUTS.balloonOpen);
			log('✅ SWT balloon opened');
			result.balloonOpened = true;
		} catch (e) {
			warn('❌ SWT balloon did not open:', e.message);
			return result;
		}

		log(`Leaving balloon open for ${BALLOON_OPEN_DURATION}ms before closing...`);
		await sleep(BALLOON_OPEN_DURATION);

		try {
			const closeBtn = await waitFor(
				() => isVisible(SELECTORS.balloonCloseButtonSelector) && document.querySelector(SELECTORS.balloonCloseButtonSelector),
				'balloon close button (.walkme-custom-balloon-close-button) visible',
				TIMEOUTS.balloonOpen
			);
			closeBtn.click();
			log('Clicked balloon close button');
			await waitFor(() => !isVisible(SELECTORS.balloonSelector), 'SWT balloon closed', TIMEOUTS.balloonOpen);
			log('✅ SWT balloon closed');
			result.balloonClosed = true;
		} catch (e) {
			warn('❌ SWT balloon did not close:', e.message);
			dumpWalkmeDiagnostics();
		}

		return result;
	}

	// Boolean result fields that count as pass/fail checks for each mode (in report order).
	// aiResponseText/environment/mode/libVersion are informational, not checks.
	const CHECK_KEYS_BY_MODE = {
		'AI Action Bar': ['playerIsCopilot', 'aiEnabledConfirmed', 'menuOpened', 'menuClosed', 'quickActionOpened', 'textEntered', 'generateClicked', 'aiResponseReceived'],
		'NO AI Action Bar': ['playerIsCopilot', 'menuOpened', 'menuClosed', 'launcherTriggered', 'balloonOpened', 'balloonClosed']
	};

	// ---------------------------------------------------------------------
	// Run
	// ---------------------------------------------------------------------
	const { env, mode } = await promptSelection(ENVIRONMENTS, MODES, CONFIG_BY_ENV);
	const modeConfig = CONFIG_BY_ENV[env][getModeConfigKey(mode)];

	injectSnippet(modeConfig.snippetUrl);
	await waitFor(
		() => typeof wmjQuery !== 'undefined' && typeof window.WalkMePlayerAPI?.toggleMenu === 'function' && isVisible('#walkme-player'),
		'WalkMe player loaded',
		TIMEOUTS.player
	);
	log(`Player loaded ✅ (env=${env}, mode=${mode})`);

	const results = { environment: env, mode, libVersion: getLibVersion() };
	Object.assign(results, checkSiteConfig(mode));
	Object.assign(results, await runMenuTriggeredFlow());
	Object.assign(results, mode === 'AI Action Bar' ? await runAiActionBarFlow() : await runNoAiActionBarFlow(modeConfig));

	console.table(results);

	const failedChecks = CHECK_KEYS_BY_MODE[mode].filter(key => !results[key]);
	if (failedChecks.length === 0) {
		log('✅ All checks passed');
	} else {
		warn(`❌ ${failedChecks.length} check(s) failed:`, failedChecks.join(', '));
	}

	return results;
};

// Auto-run when this file is pasted directly into devtools on an arbitrary page (no #startTest
// button present). When loaded via <script src> on a host page that has its own #startTest
// button (e.g. auto.html), skip auto-run and let that page's click handler call
// window.runWalkmeSwtTest() instead.
if (!document.getElementById('startTest')) {
	window.runWalkmeSwtTest().catch(e => console.warn('%c[WM-TEST]', 'color:#e17055;font-weight:bold', e.message));
}
