export function updateOriginTrialMetaTag(token: string | null): void {
  const head = document.head;
  let metaTag = head.querySelector('meta[http-equiv="origin-trial"]') as
    | HTMLMetaElement
    | null;

  if (token && token.trim()) {
    if (!metaTag) {
      metaTag = document.createElement("meta");
      metaTag.httpEquiv = "origin-trial";
      head.appendChild(metaTag);
    }
    metaTag.content = token;
  } else {
    // Remove meta tag if no token
    if (metaTag) {
      metaTag.remove();
    }
  }
}
