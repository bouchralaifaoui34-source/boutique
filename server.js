require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========== Modèles (Schemas) ==========
const variantSchema = new mongoose.Schema({
  color: String,
  size: String,
  stock: { type: Number, default: 0 }
});

const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  images: [String],
  description: String,
  variants: [variantSchema]
});

const orderSchema = new mongoose.Schema({
  customerName: String,
  phone: String,
  wilaya: String,
  baladia: String,
  deliveryType: String,
  shippingCost: Number,
  total: Number,
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: String,
    color: String,
    size: String,
    quantity: Number,
    price: Number
  }],
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const settingSchema = new mongoose.Schema({
  shopName: { type: String, default: 'Lorea Boutique' },
  shopLogo: { type: String, default: '' },
  instagramHandle: { type: String, default: '' },
  description: { type: String, default: 'Votre élégance chez vous' }
});

const deliveryCostSchema = new mongoose.Schema({
  wilaya: { type: String, unique: true, required: true },
  bureau: { type: Number, default: 300 },
  domicile: { type: Number, default: 600 }
});

const Product = mongoose.model('Product', productSchema);
const Order = mongoose.model('Order', orderSchema);
const Setting = mongoose.model('Setting', settingSchema);
const DeliveryCost = mongoose.model('DeliveryCost', deliveryCostSchema);

// ========== Liste des 58 wilayas algériennes ==========
const allWilayas = [
  "Adrar", "Chlef", "Laghouat", "Oum El Bouaghi", "Batna", "Béjaïa", "Biskra", "Béchar", "Blida", "Bouira",
  "Tamanrasset", "Tébessa", "Tlemcen", "Tiaret", "Tizi Ouzou", "Alger", "Djelfa", "Jijel", "Sétif", "Saïda",
  "Skikda", "Sidi Bel Abbès", "Annaba", "Guelma", "Constantine", "Médéa", "Mostaganem", "M'Sila", "Mascara",
  "Ouargla", "Oran", "El Bayadh", "Illizi", "Bordj Bou Arreridj", "Boumerdès", "El Tarf", "Tindouf", "Tissemsilt",
  "El Oued", "Khenchela", "Souk Ahras", "Tipaza", "Mila", "Aïn Defla", "Naâma", "Aïn Témouchent", "Ghardaïa",
  "Relizane", "Timimoun", "Bordj Badji Mokhtar", "Ouled Djellal", "Béni Abbès", "In Salah", "In Guezzam",
  "Touggourt", "Djanet", "El M'Ghair", "El Meniaa"
];

// ========== Initialisation des frais de livraison ==========
async function initDeliveryCosts() {
  for (const wilaya of allWilayas) {
    const exists = await DeliveryCost.findOne({ wilaya });
    if (!exists) {
      await DeliveryCost.create({ wilaya, bureau: 300, domicile: 600 });
    }
  }
  console.log("✅ 58 wilayas initialisées avec prix par défaut (bureau:300, domicile:600)");
}

// ========== Routes Settings ==========
app.get('/api/settings', async (req, res) => {
  let settings = await Setting.findOne();
  if (!settings) settings = await Setting.create({});
  res.json(settings);
});

app.put('/api/settings', async (req, res) => {
  let settings = await Setting.findOne();
  if (!settings) settings = new Setting(req.body);
  else Object.assign(settings, req.body);
  await settings.save();
  res.json(settings);
});

// ========== Routes Products ==========
app.get('/api/products', async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Produit non trouvé' });
    res.json(product);
  } catch(e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== Routes Delivery Costs ==========
app.get('/api/delivery-costs', async (req, res) => {
  const costs = await DeliveryCost.find().sort({ wilaya: 1 });
  res.json(costs);
});

app.get('/api/delivery-costs/:wilaya', async (req, res) => {
  const wilaya = decodeURIComponent(req.params.wilaya);
  let cost = await DeliveryCost.findOne({ wilaya });
  if (!cost) {
    cost = { wilaya, bureau: 300, domicile: 600 };
  }
  res.json(cost);
});

app.post('/api/delivery-costs', async (req, res) => {
  const { wilaya, bureau, domicile } = req.body;
  try {
    const result = await DeliveryCost.findOneAndUpdate(
      { wilaya },
      { bureau, domicile },
      { upsert: true, new: true }
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/delivery-costs/:wilaya', async (req, res) => {
  const wilaya = decodeURIComponent(req.params.wilaya);
  await DeliveryCost.deleteOne({ wilaya });
  res.json({ success: true });
});

// ========== Routes Orders ==========
app.post('/api/orders', async (req, res) => {
  const { items, customerName, phone, wilaya, baladia, deliveryType, shippingCost, total } = req.body;
  
  for (let item of items) {
    const product = await Product.findById(item.productId);
    if (!product) return res.status(400).json({ error: 'Produit introuvable' });
    const variant = product.variants.find(v => v.color === item.color && v.size === item.size);
    if (!variant || variant.stock < item.quantity) {
      return res.status(400).json({ error: `Stock insuffisant pour ${product.name} (${item.color}, ${item.size})` });
    }
  }
  
  for (let item of items) {
    await Product.updateOne(
      { _id: item.productId, "variants.color": item.color, "variants.size": item.size },
      { $inc: { "variants.$.stock": -item.quantity } }
    );
  }
  
  const fullItems = [];
  for (let item of items) {
    const product = await Product.findById(item.productId);
    fullItems.push({ ...item, productName: product.name, price: product.price });
  }
  
  const order = new Order({ items: fullItems, customerName, phone, wilaya, baladia, deliveryType, shippingCost, total });
  await order.save();
  
  // Notification Telegram (optionnelle)
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    let itemsText = '';
    fullItems.forEach(item => {
      itemsText += `\n• ${item.productName} (${item.color}, ${item.size}) x${item.quantity} = ${item.price * item.quantity} DA`;
    });
    const message = `🛍 Nouvelle commande\n👤 ${customerName}\n📞 ${phone}\n📍 ${wilaya} - ${baladia}\n📦${itemsText}\n💰 Total: ${total} DA`;
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(message)}`);
  }
  
  res.json({ success: true, orderId: order._id });
});

app.get('/api/orders', async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  res.json(orders);
});

// ========== Connexion MongoDB et démarrage ==========
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ Connecté à MongoDB');
    await initDeliveryCosts();
  })
  .catch(err => console.error('❌ Erreur MongoDB:', err));

// ========== Pour Vercel (serverless) ==========
module.exports = app;

// ========== Pour le développement local ==========
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`🚀 Serveur démarré sur le port ${PORT}`));
}