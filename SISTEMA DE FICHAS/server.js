require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Conexão MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/bar-pdv', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB Conectado')).catch(err => console.log(err));

// Modelos (Schemas)
const ProductSchema = new mongoose.Schema({
    name: String,
    price: Number,
    category: String
});
const Product = mongoose.model('Product', ProductSchema);

const OrderSchema = new mongoose.Schema({
    productName: String,
    price: Number,
    waiter: String,
    date: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', OrderSchema);

// Rotas de Produtos (Admin)
app.get('/api/products', async (req, res) => {
    const products = await Product.find();
    res.json(products);
});

app.post('/api/products', async (req, res) => {
    const newProduct = new Product(req.body);
    await newProduct.save();
    res.json(newProduct);
});

app.delete('/api/products/:id', async (req, res) => {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Produto removido' });
});

// Rotas de Vendas (Garçom e Admin)
app.post('/api/orders', async (req, res) => {
    const order = new Order(req.body);
    await order.save();
    res.json(order);
});

app.get('/api/orders/today', async (req, res) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    
    const orders = await Order.find({ date: { $gte: start, $lte: end } });
    res.json(orders);
});

app.delete('/api/orders/clear-today', async (req, res) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    
    await Order.deleteMany({ date: { $gte: start, $lte: end } });
    res.json({ message: 'Faturamento zerado' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));