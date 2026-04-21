
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
  let dpdRaw = null; // ✅ always defined, safe for logging

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
        orderAction: 'calculate',
        orderGeneralData: { orderType: 'shipment' },
        sender: {
          country: 'DE',
          zipCode: '55411',
          city: 'Bingen',
          street: 'Warehouse 1',
          name: 'EnglischBuecher',
        },
        receiver: {
          country: 'DE',
          zipCode: to_postal,
          city: to_city || 'Berlin',
          street: 'Musterstraße 1',
          name: 'Customer',
        },
        parcels: [
          { weight: Math.max(1, weight_grams / 1000) },
        ],
        productAndServiceData: {
          product: 'CL',
          orderType: 'CL',
          b2c: true,
        },
      },
    };

    const resp = await axios.post(DPD_BASE, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 20000,
    });

    dpdRaw = resp.data; // ✅ now safe for later logging

    const price =
      dpdRaw?.orderResult?.orderSummary?.totalGrossAmount ??
      dpdRaw?.orderResult?.shipmentFee?.totalAmount;

    if (!price) {
      return res.status(500).json({ error: 'DPD returned no price', dpd: dpdRaw });
    }

    return res.json({
      provider: 'DPD',
      service: 'DPD Classic',
      amount_eur: Number(price),
      currency: 'EUR',
      estimated_days: 1,
    });
  } catch (err) {
    // ✅ log what DPD actually returned (if anything)
    const dpdErr = err?.response?.data || null;

    console.error('DPD Cloud estimate error:', dpdErr || err.message);

    if (dpdErr) {
      console.log('DPD Cloud raw response:', JSON.stringify(dpdErr, null, 2));
    }

    return res.status(500).json({ error: 'DPD estimate failed', dpd: dpdErr });
  }
});

module.exports = router;
