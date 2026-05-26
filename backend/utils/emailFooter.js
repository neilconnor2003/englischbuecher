
module.exports = (lang = 'en') => {
    const isDE = lang === 'de';

    return `
    <div style="background:#0f172a; color:#e2e8f0; padding:30px 20px; margin-top:30px; font-family:Arial, sans-serif; border-radius:12px;">
      
      <div style="max-width:600px; margin:auto;">

        <!-- BRAND -->
        <div style="text-align:center; margin-bottom:25px;">
          
        <a href="https://englischbuecher.de" target="_blank" style="text-decoration:none;">
            <img src="https://englischbuecher.de/assets/logo.png"
                alt="Englisch Buecher"
                style="height:50px; margin-bottom:10px;" />
        </a>

          <p style="font-size:14px; opacity:0.8;">
            ${isDE ? 'Dein Shop für englische Bücher in Deutschland' : 'Your shop for English books in Germany'}
          </p>
        </div>

        <!-- LINKS -->
        <div style="display:flex; flex-wrap:wrap; justify-content:space-between; gap:20px; font-size:14px;">

          <div style="flex:1; min-width:120px;">
            <strong style="color:#ddd6fe;">
              ${isDE ? 'Unternehmen' : 'Company'}
            </strong>
            <div>
              <a href="https://englischbuecher.de/about" style="color:#cbd5e1; text-decoration:none;">${isDE ? 'Über uns' : 'About'}</a><br/>
              <a href="https://englischbuecher.de/contact" style="color:#cbd5e1; text-decoration:none;">${isDE ? 'Kontakt' : 'Contact'}</a><br/>
              <a href="https://englischbuecher.de/imprint" style="color:#cbd5e1; text-decoration:none;">${isDE ? 'Impressum' : 'Imprint'}</a>
            </div>
          </div>

          <div style="flex:1; min-width:120px;">
            <strong style="color:#ddd6fe;">
              ${isDE ? 'Rechtliches' : 'Legal'}
            </strong>
            <div>
              <a href="https://englischbuecher.de/privacy" style="color:#cbd5e1; text-decoration:none;">${isDE ? 'Datenschutz' : 'Privacy'}</a><br/>
              <a href="https://englischbuecher.de/terms" style="color:#cbd5e1; text-decoration:none;">${isDE ? 'AGB' : 'Terms'}</a><br/>
              <a href="https://englischbuecher.de/revocation" style="color:#cbd5e1; text-decoration:none;">${isDE ? 'Widerruf' : 'Revocation'}</a><br/>
              <a href="https://englischbuecher.de/shipping" style="color:#cbd5e1; text-decoration:none;">${isDE ? 'Versand' : 'Shipping'}</a>
            </div>
          </div>

          <div style="flex:1; min-width:120px;">
            <strong style="color:#ddd6fe;">
              ${isDE ? 'Support' : 'Support'}
            </strong>
            <div>
              <a href="https://englischbuecher.de/faq" style="color:#cbd5e1; text-decoration:none;">FAQ</a><br/>
              <a href="https://englischbuecher.de/returns" style="color:#cbd5e1; text-decoration:none;">${isDE ? 'Rückgabe' : 'Returns'}</a>
            </div>
          </div>

        </div>

        <!-- BOTTOM -->
        <div style="text-align:center; margin-top:25px; font-size:12px; color:#94a3b8;">
          © ${new Date().getFullYear()} EnglischBücher
        </div>

      </div>
    </div>
  `;
};
