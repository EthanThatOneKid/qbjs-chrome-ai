import * as lzutf8 from "lzutf8";

/**
 * compileQbjsUrl makes a QBJS URL.
 *
 * @see
 * https://github.com/boxgaming/qbjs/blob/814bee8d7579d77029b85f37cd2c64d6c60983b7/qbjs-ide.js#L469
 */
export function compileQbjsUrl(
  code: string,
  mode?: "play" | "auto",
): string {
  let url = "https://qbjs.org?";
  if (mode) {
    url += "mode=" + mode + "&";
  }

  const compressedCode = lzutf8.compress(code, { outputEncoding: "Base64" });
  url += "code=" + compressedCode;
  return url;
}
