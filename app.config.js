const fs = require('fs');
const path = require('path');
const os = require('os');

function getActiveExpoUser() {
  try {
    const statePath = path.join(os.homedir(), '.expo', 'state.json');
    if (fs.existsSync(statePath)) {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      if (state?.auth?.username) {
        return state.auth.username;
      }
    }
  } catch (e) {
    // Hata durumunda yutulur
  }
  return null;
}

module.exports = ({ config }) => {
  const projectIds = {
    smlztrk: '9c17fe1c-ca63-4de3-af7a-76d131e3db7a',
    smlztrkk: process.env.EAS_PROJECT_ID_SMLZTRKK || '623e6424-f00a-47e4-a5a5-676cc3e1a6be',
  };

  // 1. Öncelik: EAS Cloud Build sunucusundaki EAS_BUILD_PROJECT_ID değişkeni
  let targetAccount = null;
  if (process.env.EAS_BUILD_PROJECT_ID) {
    if (process.env.EAS_BUILD_PROJECT_ID === projectIds.smlztrkk) {
      targetAccount = 'smlztrkk';
    } else if (process.env.EAS_BUILD_PROJECT_ID === projectIds.smlztrk) {
      targetAccount = 'smlztrk';
    }
  }

  // 2. Öncelik: Manuel ortam değişkeni (EXPO_ACCOUNT / EAS_ACCOUNT)
  if (!targetAccount) {
    targetAccount = process.env.EXPO_ACCOUNT || process.env.EAS_ACCOUNT;
  }

  // 3. Öncelik: Yerel terminalde 'eas login' ile giriş yapılmış aktif kullanıcı
  if (!targetAccount) {
    targetAccount = getActiveExpoUser();
  }

  // 4. Öncelik: Varsayılan ana hesap
  if (!targetAccount) {
    targetAccount = 'smlztrk';
  }

  const selectedOwner = targetAccount === 'smlztrkk' ? 'smlztrkk' : 'smlztrk';
  const selectedProjectId = projectIds[selectedOwner] || projectIds.smlztrk;

  return {
    ...config,
    owner: selectedOwner,
    updates: {
      ...config.updates,
      url: `https://u.expo.dev/${selectedProjectId}`,
    },
    extra: {
      ...config.extra,
      eas: {
        ...config.extra?.eas,
        projectId: selectedProjectId,
      },
    },
  };
};
