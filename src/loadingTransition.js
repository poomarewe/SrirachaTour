export const loadingMotion = { hold: 1000, duration: 950, stagger: 70, layers: 3 };

export function revealLoadingScreen(element, done) {
  let finished = false;
  let fallback;
  const cleanup = () => {
    clearTimeout(hold); clearTimeout(fallback);
    element.removeEventListener('animationend', onEnd);
  };
  const finish = () => {
    if (finished) return;
    finished = true; cleanup(); done();
  };
  // Wait for the trailing layer, so the bus finishing cannot cut the other layers short.
  const onEnd = event => {
    if (event.animationName === 'journey-triangle-reveal' && event.target.classList.contains('journey-loader__layer--last')) finish();
  };
  const hold = setTimeout(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
    element.addEventListener('animationend', onEnd);
    element.classList.add('is-departing');
    // Hidden tabs and interrupted animations may not dispatch animationend.
    fallback = setTimeout(finish, loadingMotion.duration + loadingMotion.stagger * loadingMotion.layers + 150);
  }, loadingMotion.hold);
  return () => { finished = true; cleanup(); };
}
