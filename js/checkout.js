document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("checkoutForm");
  if (!form) return;

  const shipping = document.getElementById("shipping");
  const city = document.getElementById("city");
  const shippingCostEl = document.getElementById("shippingCost");
  const totalEl = document.getElementById("checkoutTotal");

  let rates = [];

  async function loadRates() {
    const { data } = await supabaseClient
      .from("shipping_rates")
      .select("*");

    rates = data || [];
    update();
  }

  function update() {
    const c = cart();

    const sub = c.reduce(
      (s, x) => s + Number(x.price) * Number(x.quantity),
      0
    );

    const r = rates.find(
      x => x.city.trim() === city.value.trim()
    );

    let cost = 0;

    if (r) {
      cost =
        shipping.value === "post"
          ? Number(r.post_cost)
          : shipping.value === "tipax"
          ? Number(r.tipax_cost)
          : Number(r.courier_cost);
    }

    shippingCostEl.textContent = money(cost);
    totalEl.textContent = money(sub + cost);
  }

  city.addEventListener("input", update);
  shipping.addEventListener("change", update);

  loadRates();

  form.addEventListener("submit", async e => {
    e.preventDefault();

    const c = cart();

    if (!c.length) {
      return toast("سبد خرید خالی است.");
    }

    const fd = new FormData(form);

    const sub = c.reduce(
      (s, x) => s + Number(x.price) * Number(x.quantity),
      0
    );

    const r = rates.find(
      x => x.city.trim() === fd.get("city").trim()
    );

    let cost = 0;

    if (r) {
      cost =
        fd.get("shipping") === "post"
          ? Number(r.post_cost)
          : fd.get("shipping") === "tipax"
          ? Number(r.tipax_cost)
          : Number(r.courier_cost);
    }

    const checkoutData = {
      customer_name: fd.get("name"),
      phone: fd.get("phone"),
      city: fd.get("city"),
      province: "گیلان",
      address: fd.get("address"),
      postal_code: fd.get("postal"),
      note: fd.get("note"),
      shipping_method: fd.get("shipping"),
      shipping_cost: cost,
      subtotal: sub,
      total: sub + cost,

      items: c.map(x => ({
        product_id: x.id,
        product_name: x.name,
        unit_price: Number(x.price),
        quantity: Number(x.quantity),
        image_url: x.cover_url || null
      }))
    };

    /*
      اطلاعات سفارش را موقتاً نگه می‌داریم
      تا بعد از پرداخت و ارسال رسید، سفارش ثبت شود.
    */
    sessionStorage.setItem(
      "nasim_checkout",
      JSON.stringify(checkoutData)
    );

    location.href = "payment.html";
  });
});