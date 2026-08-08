// __mocks__/@react-native-community/netinfo.js
//
// NetInfo bir native modul; jest node ortaminda (bkz. jest.config.js) require
// edilemiyor ve onu import eden her sey — ozellikle utils/apiCache.js — test
// edilemez hale geliyordu. Bu taklit yalnizca apiCache/ConnectivityContext'in
// kullandigi yuzeyi saglar.

const listeners = new Set();

let state = {
  isConnected: true,
  isInternetReachable: true,
  type: "wifi",
  details: null,
};

const yayinla = () => {
  for (const fn of Array.from(listeners)) fn(state);
};

const NetInfo = {
  addEventListener(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  fetch: () => Promise.resolve(state),
  configure() {},
  refresh: () => Promise.resolve(state),

  /** Test yardimcisi: baglanti durumunu degistirir ve dinleyicileri uyarir. */
  __setState(next) {
    state = { ...state, ...next };
    yayinla();
  },
  /** Test yardimcisi: varsayilan (cevrimici) duruma doner. */
  __reset() {
    state = {
      isConnected: true,
      isInternetReachable: true,
      type: "wifi",
      details: null,
    };
    listeners.clear();
  },
};

module.exports = NetInfo;
module.exports.default = NetInfo;
