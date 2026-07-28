require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

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
const CategorySchema = new mongoose.Schema({ name: String });
const Category = mongoose.model('Category', CategorySchema);

const ProductSchema = new mongoose.Schema({ name: String, price: Number, category: String });
const Product = mongoose.model('Product', ProductSchema);

const OrderSchema = new mongoose.Schema({
    productName: String, price: Number, quantity: Number, total: Number,
    waiter: String, date: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', OrderSchema);

// Rotas de Categorias e Produtos
app.get('/api/categories', async (req, res) => res.json(await Category.find()));
app.post('/api/categories', async (req, res) => res.json(await new Category(req.body).save()));
app.delete('/api/categories/:id', async (req, res) => { await Category.findByIdAndDelete(req.params.id); res.json({ message: 'OK' }); });

app.get('/api/products', async (req, res) => res.json(await Product.find()));
app.post('/api/products', async (req, res) => res.json(await new Product(req.body).save()));
app.delete('/api/products/:id', async (req, res) => { await Product.findByIdAndDelete(req.params.id); res.json({ message: 'OK' }); });

// Rotas de Vendas (Agora o Frontend dita o início e fim do dia baseado no fuso horário local)
app.post('/api/orders', async (req, res) => {
    const order = new Order(req.body);
    await order.save();
    res.json(order);
});

app.get('/api/orders', async (req, res) => {
    const { start, end } = req.query;
    let query = {};
    if (start && end) {
        query.date = { $gte: new Date(start), $lte: new Date(end) };
    }
    const orders = await Order.find(query).sort({ date: -1 });
    res.json(orders);
});

app.delete('/api/orders', async (req, res) => {
    const { start, end } = req.query;
    let query = {};
    if (start && end) {
        query.date = { $gte: new Date(start), $lte: new Date(end) };
    }
    await Order.deleteMany(query);
    res.json({ message: 'Faturamento zerado no período' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));