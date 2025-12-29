// utility.ts

export function getAnilistId(): number | null {
  const match = window.location.pathname.match(/anime\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
