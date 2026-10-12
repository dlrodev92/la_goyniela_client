/**
 * The two bands of the brand curtain page transition. They are empty, transparent, full-screen fixed layers that carry a
 * `view-transition-name`; globals.css paints and animates their view-transition groups (and hides them for every
 * transition that is not a curtain), so on the live page they are invisible and inert. Render once, in the persistent
 * app shell: it must exist both before and after the navigation for the browser to pair the layers.
 */
export function Curtain() {
  return (
    <>
      <div aria-hidden="true" className="curtain-trail" />
      <div aria-hidden="true" className="curtain-lead" />
    </>
  );
}
