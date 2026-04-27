
export function getDPDShippingPrice(weightGrams) {
  const weightKg = Math.max(0.001, weightGrams / 1000);

  if (weightKg <= 3) return 5.74;
  if (weightKg <= 5) return 6.46;
  if (weightKg <= 10) return 7.12;
  if (weightKg <= 15) return 7.77;
  //if (weightKg <= 20) return 8.43;
  //if (weightKg <= 25) return 9.47;
  //if (weightKg <= 31.5) return 10.78;

  // Safety fallback (DPD max weight is 31.5kg)
  //return 10.78;
  return 0;
}
