require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || 'TEST-TOKEN' });
const payment = new Payment(mpClient);

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/bar-pdv', {
    useNewUrlParser: true, useUnifiedTopology: true
}).then(() => console.log('MongoDB Conectado')).catch(err => console.log(err));

// ================= MODELOS =================
const Category = mongoose.model('Category', new mongoose.Schema({ name: String }));
const Product = mongoose.model('Product', new mongoose.Schema({ 
    name: String, price: Number, category: String, stock: { type: Number, default: 0 },
    ticketCount: { type: Number, default: 1 }, isWholesale: { type: Boolean, default: false } 
}));
const Order = mongoose.model('Order', new mongoose.Schema({
    items: Array, total: Number, paymentMethod: String, waiter: String, 
    date: { type: Date, default: Date.now },
    settled: { type: Boolean, default: false } // Campo para controlar se o fiado foi pago/quitado
}));
const Table = mongoose.model('Table', new mongoose.Schema({
    name: String, status: { type: String, default: 'livre' }, items: { type: Array, default: [] }
}));
const Customer = mongoose.model('Customer', new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
}));

// ================= ROTAS DE CLIENTES E FIADO =================
app.get('/api/customers', async (req, res) => {
    try { res.json(await Customer.find().sort({ name: 1 })); } 
    catch (error) { res.status(500).json({ error: 'Erro ao buscar clientes' }); }
});

app.post('/api/customers', async (req, res) => {
    try { res.status(201).json(await new Customer(req.body).save()); } 
    catch (error) { res.status(500).json({ error: 'Erro ao cadastrar cliente' }); }
});

app.delete('/api/customers/:id', async (req, res) => {
    try { await Customer.findByIdAndDelete(req.params.id); res.json({ success: true }); } 
    catch (error) { res.status(500).json({ error: 'Erro ao excluir cliente' }); }
});

// Ver extrato de fiado pendente de um cliente específico
app.get('/api/customers/debt/:name', async (req, res) => {
    try {
        const clientName = req.params.name;
        // Busca pedidos pendentes onde o método de pagamento contenha o nome do cliente e settled seja falso
        const orders = await Order.find({ 
            paymentMethod: { $regex: `Fiado - ${clientName}`, $options: 'i' },
            settled: { $ne: true }
        }).sort({ date: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar dívida do cliente' });
    }
});

// Quitar (zerar) o fiado do cliente
app.post('/api/customers/debt/:name/settle', async (req, res) => {
    try {
        const clientName = req.params.name;
        await Order.updateMany(
            { 
                paymentMethod: { $regex: `Fiado - ${clientName}`, $options: 'i' },
                settled: { $ne: true }
            },
            { $set: { settled: true } }
        );
        res.json({ success: true, msg: 'Conta quitada com sucesso!' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao quitar conta' });
    }
});

// ================= DEMAIS ROTAS =================
app.get('/api/categories', async (req, res) => res.json(await Category.find()));
app.post('/api/categories', async (req, res) => res.json(await new Category(req.body).save()));
app.delete('/api/categories/:id', async (req, res) => { await Category.findByIdAndDelete(req.params.id); res.json({ msg: 'OK' }); });

app.get('/api/products', async (req, res) => res.json(await Product.find()));
app.post('/api/products', async (req, res) => res.json(await new Product(req.body).save()));
app.put('/api/products/:id', async (req, res) => { await Product.findByIdAndUpdate(req.params.id, req.body); res.json({ msg: 'Produto atualizado' }); });
app.delete('/api/products/:id', async (req, res) => { await Product.findByIdAndDelete(req.params.id); res.json({ msg: 'OK' }); });

app.get('/api/tables', async (req, res) => res.json(await Table.find().sort({ name: 1 })));
app.post('/api/tables', async (req, res) => res.json(await new Table(req.body).save()));
app.delete('/api/tables/:id', async (req, res) => { await Table.findByIdAndDelete(req.params.id); res.json({ msg: 'OK' }); });

app.put('/api/tables/:id/add', async (req, res) => {
    try {
        const table = await Table.findById(req.params.id);
        const { product } = req.body;
        const existingItem = table.items.find(i => i.id === product._id);
        if (existingItem) existingItem.quantity += 1;
        else table.items.push({ id: product._id, productName: product.name, price: product.price, quantity: 1, ticketCount: product.ticketCount, isWholesale: product.isWholesale });
        table.status = 'ocupada'; table.markModified('items');
        await table.save(); res.json(table);
    } catch (error) { res.status(500).json({ error: 'Erro' }); }
});

app.put('/api/tables/:id/remove', async (req, res) => {
    try {
        const table = await Table.findById(req.params.id);
        const itemIndex = table.items.findIndex(i => i.id === req.body.productId);
        if (itemIndex > -1) {
            table.items[itemIndex].quantity -= 1;
            if (table.items[itemIndex].quantity <= 0) table.items.splice(itemIndex, 1);
        }
        if (table.items.length === 0) table.status = 'livre';
        table.markModified('items');
        await table.save(); res.json(table);
    } catch (error) { res.status(500).json({ error: 'Erro' }); }
});

app.post('/api/tables/:id/checkout', async (req, res) => {
    try {
        const table = await Table.findById(req.params.id);
        const isFiado = req.body.paymentMethod && req.body.paymentMethod.startsWith('Fiado -');
        await new Order({ 
            items: req.body.items, 
            total: req.body.total, 
            paymentMethod: req.body.paymentMethod, 
            waiter: req.body.waiter || 'Garçom',
            settled: false 
        }).save();
        if (req.body.items && Array.isArray(req.body.items)) {
            for (let item of req.body.items) {
                if (item.id) await Product.findByIdAndUpdate(item.id, { $inc: { stock: -item.quantity } });
            }
        }
        table.items = []; table.status = 'livre'; await table.save();
        res.json({ msg: 'Mesa fechada' });
    } catch (error) { res.status(500).json({ error: 'Erro' }); }
});

app.post('/api/pix', async (req, res) => {
    try {
        const result = await payment.create({
            body: { transaction_amount: req.body.total, description: 'Venda Conteiner Beer', payment_method_id: 'pix', payer: { email: 'cliente@conteinerbeer.com' } }
        });
        res.json({ id: result.id, qr_code_base64: result.point_of_interaction.transaction_data.qr_code_base64 });
    } catch (error) { res.status(500).json({ error: 'Erro ao gerar PIX' }); }
});
app.get('/api/pix/:id', async (req, res) => { try { res.json({ status: (await payment.get({ id: req.params.id })).status }); } catch (error) { res.status(500).json({ error: 'Erro' }); } });

app.post('/api/orders', async (req, res) => {
    try {
        await new Order({ ...req.body, settled: false }).save();
        if (req.body.items && Array.isArray(req.body.items)) {
            for (let item of req.body.items) {
                if (item.id) await Product.findByIdAndUpdate(item.id, { $inc: { stock: -item.quantity } });
            }
        }
        res.json({ msg: 'Pedido salvo' });
    } catch (error) { res.status(500).json({ error: 'Erro' }); }
});

app.get('/api/orders', async (req, res) => {
    try {
        const { start, end } = req.query;
        let query = {};
        if (start && end) query.date = { $gte: new Date(start), $lte: new Date(end) };
        res.json(await Order.find(query).sort({ date: -1 }));
    } catch (error) { res.status(500).json({ error: 'Erro' }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));