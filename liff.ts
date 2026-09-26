import liff from "@line/liff";
import { useEffect } from "react";

export async function initLiff() {
  await liff.init({
    liffId: import.meta.env.VITE_LIFF_ID,
  });
  
  const idToken = liff.getIDToken();

console.log(idToken);

  return liff;
}

export function useLiffInit() {
  useEffect(() => {
    const init = async () => {
      await liff.init({
        liffId: import.meta.env.VITE_LIFF_ID,
      });

      console.log("LIFF initialized");
    };

    init();
  }, []);
}