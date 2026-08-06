import Image from "next/image";
import Link from "next/link";
import { ExternalLink, MapPin } from "lucide-react";

export default function SiteFooter() {
  return (
    <footer className="par3-site-footer">
      <div className="par3-footer-inner">
        <div className="par3-footer-brand">
          <Image
            src="/par3/par3-logo.png"
            alt="CGS Par 3 Showdown"
            width={92}
            height={92}
          />
          <div>
            <strong>CGS Par 3 Showdown</strong>
            <p>Saturday 12 September 2026</p>
          </div>
        </div>
        <div className="par3-footer-venue">
          <MapPin />
          <span>
            <strong>The Tee Lounge</strong>
            2892-2896 Logan Rd, Underwood QLD 4119
          </span>
        </div>
        <div className="par3-footer-links">
          <a
            href="https://www.youtube.com/@CrossodogGolfSociety"
            target="_blank"
            rel="noopener noreferrer"
          >
            YouTube <ExternalLink />
          </a>
          <a
            href="https://crossodoggolfs-shop.bigcartel.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            CGS shop <ExternalLink />
          </a>
          <Link href="/privacy">Privacy</Link>
          <Link href="/clubhouse-admin">Admin</Link>
        </div>
      </div>
      <div className="par3-footer-base">
        &copy; 2026 Crossodog Golf Society. Built for everyday golfers.
      </div>
    </footer>
  );
}
