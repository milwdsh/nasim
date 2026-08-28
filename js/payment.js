document.addEventListener("DOMContentLoaded", () => {

  const form = document.getElementById("paymentForm");
  const receiptInput = document.getElementById("receipt");
  const preview = document.getElementById("receiptPreview");
  const totalEl = document.getElementById("paymentTotal");

  const saved = sessionStorage.getItem("nasim_checkout");

  if (!saved) {
    location.href = "cart.html";
    return;
  }

  const checkout = JSON.parse(saved);

  totalEl.textContent = money(checkout.total);


  // =========================
  // پیش نمایش رسید
  // =========================

  receiptInput.addEventListener("change", () => {

    const file = receiptInput.files[0];

    if (!file) {
      preview.innerHTML = "";
      return;
    }

    if (!file.type.startsWith("image/")) {
      receiptInput.value = "";
      preview.innerHTML = "";
      return toast("لطفاً یک تصویر معتبر انتخاب کنید.");
    }

    // محدودیت 8MB
    if (file.size > 8 * 1024 * 1024) {
      receiptInput.value = "";
      preview.innerHTML = "";
      return toast("حجم تصویر نباید بیشتر از ۸ مگابایت باشد.");
    }

    const reader = new FileReader();

    reader.onload = e => {

      preview.innerHTML = `
        <img
          src="${e.target.result}"
          alt="پیش‌نمایش رسید پرداخت"
        >
      `;

    };

    reader.readAsDataURL(file);

  });


  // =========================
  // ثبت پرداخت
  // =========================

  form.addEventListener("submit", async e => {

    e.preventDefault();

    const file = receiptInput.files[0];

    if (!file) {
      return toast("لطفاً تصویر رسید را انتخاب کنید.");
    }

    const submitBtn = form.querySelector("button");

    submitBtn.disabled = true;
    submitBtn.textContent = "در حال ثبت سفارش...";


    try {

      // =========================
      // آپلود رسید
      // =========================

      const extension =
        file.name.split(".").pop().toLowerCase();

      const fileName =
        `receipt-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 10)}.${extension}`;

      const filePath =
        `orders/${fileName}`;


      const {
        error: uploadError
      } = await supabaseClient
        .storage
        .from("receipts")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false
        });


      if (uploadError) {
        throw uploadError;
      }


      // =========================
      // لینک رسید
      // =========================

      const {
        data: publicUrlData
      } = supabaseClient
        .storage
        .from("receipts")
        .getPublicUrl(filePath);

      const receiptUrl =
        publicUrlData.publicUrl;


      // =========================
      // ایجاد سفارش
      // =========================

      const {
        data: order,
        error: orderError
      } = await supabaseClient
        .from("orders")
        .insert({

          customer_name:
            checkout.customer_name,

          phone:
            checkout.phone,

          city:
            checkout.city,

          province:
            checkout.province,

          address:
            checkout.address,

          postal_code:
            checkout.postal_code,

          note:
            checkout.note,

          shipping_method:
            checkout.shipping_method,

          shipping_cost:
            checkout.shipping_cost,

          subtotal:
            checkout.subtotal,

          total:
            checkout.total,

          receipt_url:
            receiptUrl,

          payment_status:
            "pending",

          order_status:
            "pending_payment"

        })
        .select()
        .single();


      if (orderError) {
        throw orderError;
      }


      // =========================
      // ثبت آیتم‌های سفارش
      // =========================

      const items =
        checkout.items.map(item => ({

          order_id:
            order.id,

          product_id:
            item.product_id,

          product_name:
            item.product_name,

          unit_price:
            item.unit_price,

          quantity:
            item.quantity,

          image_url:
            item.image_url

        }));


      const {
        error: itemsError
      } = await supabaseClient
        .from("order_items")
        .insert(items);


      if (itemsError) {
        throw itemsError;
      }


      // =========================
      // پاک کردن سبد
      // =========================

      sessionStorage.removeItem("nasim_checkout");

      localStorage.removeItem("nasim_cart");


      // =========================
      // صفحه موفقیت
      // =========================

      location.href =
        `order-success.html?order=${order.order_number}`;

    }

    catch (error) {

      console.error(error);

      toast(
        error.message ||
        "خطایی در ثبت سفارش رخ داد."
      );

      submitBtn.disabled = false;

      submitBtn.textContent =
        "ارسال رسید و ثبت سفارش";

    }

  });

});