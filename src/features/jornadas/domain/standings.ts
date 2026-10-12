/** Sofascore standings widgets embedded in the jornada detail. The srcs are fixed by the widget provider. */
export type StandingsEmbed = {
  id: "laliga" | "liga-f" | "laliga-2";
  /** Short label for the tab. */
  tabLabel: string;
  /** Competition name shown in the frame header. */
  name: string;
  src: string;
  /** Fixed iframe height in px (the widget does not resize itself). */
  height: number;
  /** Public Sofascore page, used for the attribution and the fallback link. */
  attributionUrl: string;
};

export const STANDINGS_MAX_WIDTH = 768;

export const STANDINGS: readonly StandingsEmbed[] = [
  {
    id: "laliga",
    tabLabel: "LaLiga",
    name: "LaLiga 26/27",
    src: "https://widgets.sofascore.com/en/embed/tournament/36/season/97268/standings/LaLiga%2026%2F27?widgetTitle=LaLiga%2026%2F27&showCompetitionLogo=true",
    height: 1123,
    attributionUrl: "https://www.sofascore.com/football/tournament/spain/laliga/8#id:97268",
  },
  {
    id: "liga-f",
    tabLabel: "Liga F",
    name: "Liga F 26/27",
    src: "https://widgets.sofascore.com/en/embed/tournament/3739/season/97379/standings/Primera%20Division%2C%20Women%2026%2F27?widgetTitle=Primera%20Division%2C%20Women%2026%2F27&showCompetitionLogo=true",
    height: 963,
    attributionUrl: "https://www.sofascore.com/football/tournament/spain/liga-f/1127#id:97379",
  },
  {
    id: "laliga-2",
    tabLabel: "LaLiga 2",
    name: "LaLiga 2 26/27",
    src: "https://widgets.sofascore.com/en/embed/tournament/37/season/97280/standings/LaLiga%202%2026%2F27?widgetTitle=LaLiga%202%2026%2F27&showCompetitionLogo=true",
    height: 1203,
    attributionUrl: "https://www.sofascore.com/football/tournament/spain/laliga-2/54#id:97280",
  },
];

export type StandingsLoadState = "loading" | "loaded" | "slow";

/** What the frame wrapper shows for a load state. The iframe itself is never hidden: the skeleton only covers it while loading. */
export function standingsFrameView(state: StandingsLoadState): { skeleton: boolean; message: string } {
  const message = state === "loading" ? "Cargando clasificación…" : state === "slow" ? "La clasificación tarda en cargar." : "¿No ves la tabla?";
  return { skeleton: state === "loading", message };
}
