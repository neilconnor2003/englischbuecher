
const express = require('express');
const axios = require('axios');

const router = express.Router();

const DPD_BASE = 'https://cloud.dpd.com/api/v1/setOrder';

// Credentials from DPD mail
const PARTNER = {
    name: 'DPD Cloud Service Alpha2',
    token: process.env.DPD_PARTNER_TOKEN,
};

const USER = {
    cloudUserID: process.env.DPD_CLOUD_USER_ID,
    token: process.env.DPD_USER_TOKEN,
};

// Your warehouse address
const SENDER = {
    country: 'DE',
    zipCode: '55411',
    city: 'Bingen',
    street: 'Im Schwalg 60',
};

router.post('/estimate', async (req, res) => {
    try {
        const { to_postal, to_city, weight_grams } = req.body;

        if (!to_postal || !weight_grams) {
            return res.status(400).json({ error: 'postal code and weight required' });
        }

        const payload = {
            partnerCredentials: {
                name: PARTNER.name,
                token: PARTNER.token,
            },
            userCredentials: {
                cloudUserID: USER.cloudUserID,
                token: USER.token,
            },
            order: {
                orderAction: 'calculate',          // ✅ REQUIRED
                orderGeneralData: {
                    orderType: 'shipment',           // ✅ REQUIRED (consignment often suppresses price)
                },
                sender: {
                    country: 'DE',
                    zipCode: '55411',
                    city: 'Bingen',
                    street: 'Warehouse 1',
                    name: 'EnglischBuecher',          // ✅ REQUIRED by many contracts
                },
                receiver: {
                    country: 'DE',
                    zipCode: to_postal,
                    city: to_city || 'Berlin',
                    street: 'Musterstraße 1',         // ✅ REQUIRED
                    name: 'Customer',                 // ✅ REQUIRED by many contracts
                },
                parcels: [
                    {
                        weight: Math.max(1, weight_grams / 1000),  // ✅ minimum 1kg
                    },
                ],
                productAndServiceData: {
                    product: 'CL',                   // ✅ REQUIRED
                    orderType: 'CL',                 // ✅ REQUIRED
                    b2c: true,                       // ✅ VERY IMPORTANT
                },
            },
        };

        const { data } = await axios.post(DPD_BASE, payload, {
            headers: { 'Content-Type': 'application/json' },
        });

        //const price = data?.orderResult?.shipmentFee?.totalAmount;
        const price =
            data?.orderResult?.orderSummary?.totalGrossAmount ??
            data?.orderResult?.shipmentFee?.totalAmount;


        if (!price) {
            return res.status(500).json({ error: 'DPD returned no price' });
        }

        res.json({
            provider: 'DPD',
            service: 'DPD Classic',
            amount_eur: Number(price),
            currency: 'EUR',
            estimated_days: 1,
        });
    } catch (err) {
        console.error('DPD Cloud estimate error:', err?.response?.data || err.message);
        console.log('DPD Cloud raw response:', JSON.stringify(data, null, 2));
        res.status(500).json({ error: 'DPD estimate failed' });
    }
});

module.exports = router;
