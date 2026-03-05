import type { Message, MessageResponse } from '../../lib/messages';
import { getApiKeys, setApiKeys, isEnabled, setEnabled, isSetupComplete } from '../../lib/storage';
import { DAILY_LIMIT } from '../../lib/constants';

const $ = (id: string) => document.getElementById(id)!;

async function init() {
  const setupDone = await isSetupComplete();

  if (setupDone) {
    showMain();
  } else {
    showWizard();
  }
}

// --- Wizard ---

let wizardStep = 1;

function showWizard() {
  $('wizard').classList.remove('hidden');
  $('main').classList.add('hidden');
  updateWizardStep();

  $('wizard-next').addEventListener('click', handleWizardNext);
  $('wizard-back').addEventListener('click', handleWizardBack);
}

function updateWizardStep() {
  $('wizard-step-1').classList.toggle('hidden', wizardStep !== 1);
  $('wizard-step-2').classList.toggle('hidden', wizardStep !== 2);
  $('wizard-back').classList.toggle('hidden', wizardStep === 1);
  $('wizard-next').textContent = wizardStep === 2 ? 'Finish' : 'Next';
}

async function handleWizardNext() {
  const errorEl = $('wizard-error');
  errorEl.classList.add('hidden');

  if (wizardStep === 1) {
    const omdbKey = ($('wizard-omdb') as HTMLInputElement).value.trim();
    if (!omdbKey) {
      errorEl.textContent = 'Please enter your OMDb API key';
      errorEl.classList.remove('hidden');
      return;
    }
    wizardStep = 2;
    updateWizardStep();
  } else {
    const omdbKey = ($('wizard-omdb') as HTMLInputElement).value.trim();
    const tmdbKey = ($('wizard-tmdb') as HTMLInputElement).value.trim();
    if (!tmdbKey) {
      errorEl.textContent = 'Please enter your TMDB API key';
      errorEl.classList.remove('hidden');
      return;
    }
    await setApiKeys(omdbKey, tmdbKey);
    $('wizard').classList.add('hidden');
    showMain();
  }
}

function handleWizardBack() {
  wizardStep = 1;
  updateWizardStep();
}

// --- Main ---

async function showMain() {
  $('main').classList.remove('hidden');
  $('wizard').classList.add('hidden');

  const enabled = await isEnabled();
  ($('toggle-enabled') as HTMLInputElement).checked = enabled;

  $('toggle-enabled').addEventListener('change', async (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    await setEnabled(checked);
  });

  $('clear-cache').addEventListener('click', async () => {
    const msg: Message = { type: 'CLEAR_CACHE' };
    await browser.runtime.sendMessage(msg);
    await refreshStats();
  });

  $('edit-keys').addEventListener('click', async () => {
    const editor = $('key-editor');
    const isVisible = !editor.classList.contains('hidden');
    if (isVisible) {
      editor.classList.add('hidden');
      return;
    }
    const keys = await getApiKeys();
    ($('edit-omdb') as HTMLInputElement).value = keys.omdbKey;
    ($('edit-tmdb') as HTMLInputElement).value = keys.tmdbKey;
    editor.classList.remove('hidden');
  });

  $('save-keys').addEventListener('click', async () => {
    const omdb = ($('edit-omdb') as HTMLInputElement).value.trim();
    const tmdb = ($('edit-tmdb') as HTMLInputElement).value.trim();
    await setApiKeys(omdb, tmdb);
    $('key-editor').classList.add('hidden');
  });

  await refreshStats();
}

async function refreshStats() {
  try {
    const msg: Message = { type: 'GET_STATS' };
    const response = await browser.runtime.sendMessage(msg) as MessageResponse;
    if (response.type === 'STATS') {
      $('cache-count').textContent = String(response.data.cacheEntries);
      $('api-calls').textContent = String(response.data.dailyCounter.omdbCalls);
      $('remaining').textContent = String(DAILY_LIMIT - response.data.dailyCounter.omdbCalls);
    }
  } catch {
    $('cache-count').textContent = '?';
    $('api-calls').textContent = '?';
    $('remaining').textContent = '?';
  }
}

init();
