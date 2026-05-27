
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const emailFooter = require('./emailFooter');

const { logEmail } = require('./emailLogger');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    //secure: false,
    secure: true,   // ✅ VERY IMPORTANT for 465 (SSL)
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    tls: { rejectUnauthorized: false }
});

//module.exports = async (user, amount, reason = "Admin credit") => {
module.exports = async (user, amount, reason = "Admin credit", balance = null) => {

    let subject = '';
    let htmlBody = null;

    try {
        const logoPath = path.join(__dirname, '..', 'public', 'assets', 'logo.png');


        htmlBody = `
            <div style="font-family: Arial; max-width:600px; margin:auto; padding:20px; border:1px solid #eee; border-radius:12px;">
          
          ${fs.existsSync(logoPath) ? `<img src="cid:logo" style="width:100px; display:block; margin:0 auto 20px;" />` : ''}

          <h2 style="color:#6b21a8; text-align:center;">Wallet Updated</h2>
          
          <p>Hi ${user.first_name || ''},</p>

            <p>
                Your wallet has been credited with 
                <strong style="color:green;">€${amount.toFixed(2)}</strong>.
            </p>

            ${balance !== null ? `
                <div style="margin: 15px 0; padding: 12px; background: #faf5ff; border-radius: 10px; text-align: center;">
                    <div style="font-size: 14px; color: #555;">New Balance</div>
                    <div style="font-size: 22px; font-weight: bold; color: #6b21a8;">
                      €${balance.toFixed(2)}
                    </div>
                </div>
            ` : ''}


          <p>
            <strong>Reason:</strong> ${reason}
          </p>

          <p>
            You can use this balance during checkout on 
            <strong>englischbuecher.de</strong>.
          </p>

          <p style="margin-top:20px;">
            Best regards,<br/>
            <strong>Englisch Buecher Team</strong>
          </p>

          ${emailFooter(user.language || 'en')}
          
        </div>
        `;

        subject = `€${amount.toFixed(2)} added to your wallet${balance !== null ? ` (New balance €${balance.toFixed(2)})` : ''}`;


        await transporter.sendMail({
            from: `"Englisch Buecher" <${process.env.SMTP_USER}>`,
            to: user.email,
            //subject: `Wallet credited €${amount.toFixed(2)}`,
            subject,
            html: htmlBody,
            attachments: [
                fs.existsSync(logoPath)
                    ? {
                        filename: 'logo.png',
                        path: logoPath,
                        cid: 'logo'
                    }
                    : null
            ].filter(Boolean)
        });


        await logEmail({
            to: user.email,
            subject,
            html: htmlBody,
            status: 'sent',
            type: 'WalletCredit'
        });


    } catch (err) {
        console.error('WALLET EMAIL ERROR:', err);


        await logEmail({
            to: user?.email || null,
            subject: subject || 'Wallet email',
            html: htmlBody,
            status: 'failed',
            error: err.message,
            type: 'WalletCredit'
        });

    }
};
