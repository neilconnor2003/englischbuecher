
import express from 'express';
import axios from 'axios';

const router = express.Router();

const DPD_BASE = 'https://cloud.dpd.com/api/v1/setOrder';

// Credentials from DPD mail
const PARTNER = {
  name: 'DPD Cloud Service Alpha2',
  token: process.env.DPD_PARTNER_TOKEN, // 33879594E70436D58685
};

const USER = {
  cloudUserID: process.env.DPD_CLOUD_USER_ID, // 9687108
  token: process.env.DPD_USER_TOKEN,          // 635384C4734717235724
};

// Your warehouse address (must match DPD contract)
const SENDER = {
  country: 'DE',
  zipCode: '55411',
  city: 'Bingen',
  street: 'Warehouse',
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
        orderGeneralData: {
          orderType: 'consignment',
        },
        sender: {
          country: SENDER.country,
          zipCode: SENDER.zipCode,
          city: SENDER.city,
          street: SENDER.street,
        },
        receiver: {
          country: 'DE',
          zipCode: to_postal,
          city: to_city || 'Berlin',
        },
        parcels: [
          {
            weight: Math.max(0.1, weight_grams / 1000),
          },
        ],
        productAndServiceData: {
          orderType: 'CL', // DPD Classic
        },
      },
    };

    const { data } = await axios.post(DPD_BASE, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    const shipment = data?.orderResult;
    const price = shipment?.shipmentFee?.totalAmount;

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
    res.status(500).json({ error: 'DPD estimate failed' });
  }
});

export default router;
