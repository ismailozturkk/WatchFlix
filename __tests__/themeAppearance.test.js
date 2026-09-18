const { themes, buildCustomTheme, alpha } = require('../theme/colors');
const { isLightSurface, readableOn, contrastRatio } = require('../utils/colorUtils');
const { getListAccent, getSharedListAccent } = require('../utils/listAppearance');

describe('theme appearance', () => {
  test.each(Object.keys(themes))('%s uses the correct status bar appearance', (name) => {
    expect(isLightSurface(themes[name].primary)).toBe(['light', 'sky', 'green'].includes(name));
  });

  test.each(['#FFFFFF', '#000000', '#888888', '#A9C0B8', 'rgb(220,230,240)'])(
    'custom surface %s keeps list labels readable', (surface) => {
      const theme = buildCustomTheme({ primary: surface, secondary: surface });
      const accents = ['watchedMovies', 'watchedTv', 'favorites', 'watchList', 'custom']
        .map(name => getListAccent(name, theme.secondary));
      accents.push(getSharedListAccent(theme.secondary));
      for (const accent of accents) {
        expect(contrastRatio(accent, theme.secondary)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  test.each(Object.keys(themes))('%s keeps list counts readable', (name) => {
    for (const key of ['watchedMovies', 'watchedTv', 'favorites', 'watchList', 'custom']) {
      expect(contrastRatio(getListAccent(key, themes[name].secondary), themes[name].secondary))
        .toBeGreaterThanOrEqual(4.5);
    }
  });

  test('medium-light surfaces darken low contrast colors instead of washing them out', () => {
    expect(contrastRatio(readableOn('#fbbf24', '#888888'), '#888888')).toBeGreaterThanOrEqual(4.5);
  });

  test('widget colors remain stable when no surface is supplied', () => {
    expect(getListAccent('watchedMovies')).toBe('#4fc3f7');
    expect(getSharedListAccent()).toBe('#38bdf8');
  });

  test('rgba theme borders remain valid when opacity changes', () => {
    expect(alpha(themes.gray.border, 0.5)).toBe('rgba(74, 79, 88, 0.5)');
  });
});
