'use client';

import BrandMark from './BrandMark';
import { toast } from './ui';

/** Footer. The "coming soon" links show a toast instead of going nowhere. */
export default function Footer() {
  const soon = (e) => {
    e.preventDefault();
    toast('Coming soon — we are working on it 🤍');
  };

  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer__grid">
          <div>
            <span className="brand">
              <BrandMark color="#FF9FB0" />
              <span>Truce</span>
            </span>
            <p className="footer__tag">Made for the moments words are hard.</p>
            <a className="footer__mail" href="mailto:hello@truce.love">
              hello@truce.love
            </a>
          </div>

          <div className="footer__col">
            <h4>Product</h4>
            <ul>
              <li>
                <a href="#how">How it works</a>
              </li>
              <li>
                <a href="#messages">Message library</a>
              </li>
              <li>
                <a href="#pricing">Pricing</a>
              </li>
              <li>
                <a href="/c/demo">See a sample card</a>
              </li>
              <li>
                <a href="/mine">My cards</a>
              </li>
            </ul>
          </div>

          <div className="footer__col">
            <h4>Coming soon</h4>
            <ul>
              <li>
                <a href="#" onClick={soon}>
                  Birthday<span className="soon">Soon</span>
                </a>
              </li>
              <li>
                <a href="#" onClick={soon}>
                  Anniversary<span className="soon">Soon</span>
                </a>
              </li>
              <li>
                <a href="#" onClick={soon}>
                  Proposal<span className="soon">Soon</span>
                </a>
              </li>
            </ul>
          </div>

          <div className="footer__col">
            <h4>Company</h4>
            <ul>
              <li>
                <a href="#faq">FAQ</a>
              </li>
              <li>
                <a href="mailto:hello@truce.love">Support</a>
              </li>
              <li>
                <a href="#" onClick={soon}>
                  Privacy
                </a>
              </li>
              <li>
                <a href="#" onClick={soon}>
                  Terms
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer__base">
          <span>© {new Date().getFullYear()} Truce. All rights reserved.</span>
          <span>Forgiveness not included. Sincerity sold separately. 🤍</span>
        </div>
      </div>
    </footer>
  );
}
