require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Configuração Mercado Pago
const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || 'TEST-TOKEN' });
const payment = new Payment(mpClient);

// Conexão MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/bar-pdv', {
    useNewUrlParser: true, useUnifiedTopology: true
}).then(() => console.log('MongoDB Conectado')).catch(err => console.log(err));

// Modelos
const Category = mongoose.model('Category', new mongoose.Schema({ name: String }));
const Product = mongoose.model('Product', new mongoose.Schema({ 
    name: String, price: Number, category: String, stock: { type: Number, default: 0 } 
}));
const Order = mongoose.model('Order', new mongoose.Schema({
    items: Array, total: Number, paymentMethod: String, waiter: String, date: { type: Date, default: Date.now }
}));

// --- Rotas de Categorias ---
app.get('/api/categories', async (req, res) => res.json(await Category.find()));
app.post('/api/categories', async (req, res) => res.json(await new Category(req.body).save()));
app.delete('/api/categories/:id', async (req, res) => { await Category.findByIdAndDelete(req.params.id); res.json({ msg: 'OK' }); });

// --- Rotas de Produtos (Agora com Edição) ---
app.get('/api/products', async (req, res) => res.json(await Product.find()));
app.post('/api/products', async (req, res) => res.json(await new Product(req.body).save()));
// NOVA ROTA: Editar Produto
app.put('/api/products/:id', async (req, res) => {
    await Product.findByIdAndUpdate(req.params.id, req.body);
    res.json({ msg: 'Produto atualizado' });
});
app.delete('/api/products/:id', async (req, res) => { await Product.findByIdAndDelete(req.params.id); res.json({ msg: 'OK' }); });

// --- Integração Mercado Pago (Gerar PIX e Checar Status) ---
app.post('/api/pix', async (req, res) => {
    try {
        const result = await payment.create({
            body: {
                transaction_amount: req.body.total,
                description: 'Venda Conteiner Beer',
                payment_method_id: 'pix',
                payer: { email: 'cliente@conteinerbeer.com' }
            }
        });
        res.json({
            id: result.id,
            qr_code: result.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: result.point_of_interaction.transaction_data.qr_code_base64
        });
    } catch (error) { res.status(500).json({ error: 'Erro ao gerar PIX' }); }
});

app.get('/api/pix/:id', async (req, res) => {
    try {
        const payInfo = await payment.get({ id: req.params.id });
        res.json({ status: payInfo.status });
    } catch (error) { res.status(500).json({ error: 'Erro ao checar status' }); }
});

// --- Rotas de Vendas e Baixa de Estoque ---
app.post('/api/orders', async (req, res) => {
    const orderData = req.body;
    const order = new Order(orderData);
    await order.save();
    
    for (let item of orderData.items) {
        await Product.findByIdAndUpdate(item.id, { $inc: { stock: -item.quantity } });
    }
    res.json(order);
});

app.get('/api/orders', async (req, res) => {
    const { start, end } = req.query;
    let query = {};
    if (start && end) query.date = { $gte: new Date(start), $lte: new Date(end) };
    res.json(await Order.find(query).sort({ date: -1 }));
});

app.delete('/api/orders', async (req, res) => {
    const { start, end } = req.query;
    let query = {};
    if (start && end) query.date = { $gte: new Date(start), $lte: new Date(end) };
    await Order.deleteMany(query);
    res.json({ msg: 'Zerado' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));