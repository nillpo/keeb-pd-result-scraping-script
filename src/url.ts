export const COMPOSE_POST_PATH = "/compose/post";

export const isKEEBPDSearchURL = (url: URL): boolean => {
  const query = url.searchParams.get("q");
  return (
    url.pathname === "/search" &&
    url.searchParams.get("f") === "live" &&
    !!query &&
    /KEEB_PD_R\d+/.test(query)
  );
};
