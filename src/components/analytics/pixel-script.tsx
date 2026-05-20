import Script from "next/script";
import { pixelId } from "@/lib/analytics/pixel";

/**
 * Meta Pixel init + PageView. Server component — reads NEXT_PUBLIC_META_PIXEL_ID
 * at render time. Returns null when the env var is unset so the bundle does
 * not ship any fbq calls when Meta is not wired up.
 *
 * The inline init script is intentionally the canonical Facebook snippet so it
 * is recognisable to the FB Pixel Helper extension.
 */
export function PixelScript() {
  const id = pixelId();
  if (!id) return null;

  const init = `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${id}');
fbq('track', 'PageView');
`.trim();

  return (
    <>
      <Script
        id="meta-pixel-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: init }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${encodeURIComponent(id)}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
