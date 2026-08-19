require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');
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
const Category = mongoose.model('Category', new mongoose.Schema({ 
    name: String, 
    showOnline: { type: Boolean, default: true } 
}));
const Product = mongoose.model('Product', new mongoose.Schema({ 
    name: String, price: Number, category: String, stock: { type: Number, default: 0 },
    ticketCount: { type: Number, default: 1 }, isWholesale: { type: Boolean, default: false },
    minStock: { type: Number, default: 5 }
}));
const CashSupply = mongoose.model('CashSupply', new mongoose.Schema({
    amount: { type: Number, required: true }, note: { type: String, default: '' }, date: { type: Date, default: Date.now }
}));
const CashExpense = mongoose.model('CashExpense', new mongoose.Schema({
    amount: { type: Number, required: true }, description: { type: String, required: true }, category: { type: String, default: 'Outros' }, date: { type: Date, default: Date.now }
}));
const Order = mongoose.model('Order', new mongoose.Schema({
    orderNumber: { type: String, default: () => Math.random().toString(36).substring(2, 6).toUpperCase() },
    customerName: { type: String, default: '' },
    customerPhone: { type: String, default: '' },
    items: { type: Array, default: [] }, total: { type: Number, required: true }, paymentMethod: String, waiter: String,
    orderType: { type: String, default: 'sale' }, saleType: { type: String, default: 'fichas' }, tableName: { type: String, default: '' },
    requestId: { type: String, unique: true, sparse: true },
    date: { type: Date, default: Date.now },
    settled: { type: Boolean, default: false },
    printed: { type: Boolean, default: false }
}));
const Table = mongoose.model('Table', new mongoose.Schema({
    name: String, 
    status: { type: String, default: 'livre' }, 
    items: { type: Array, default: [] },
    needsPrint: { type: Boolean, default: false } 
}));
const Customer = mongoose.model('Customer', new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    payments: [{ amount: Number, date: { type: Date, default: Date.now } }],
    clubPlan: { type: String, default: 'Nenhum' }, 
    clubBalance: { type: Number, default: 0 },
    clubHistory: [{ items: Array, total: Number, date: { type: Date, default: Date.now } }]
}));
const Account = mongoose.model('Account', new mongoose.Schema({
    role: { type: String, unique: true, required: true },
    passwordHash: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now }
}));

// As senhas nunca são enviadas para o navegador nem gravadas em texto puro.
const hashPassword = (password) => new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) return reject(err);
        resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
});
const verifyPassword = (password, storedHash) => new Promise((resolve, reject) => {
    const [salt, key] = String(storedHash).split(':');
    if (!salt || !key) return resolve(false);
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) return reject(err);
        const expected = Buffer.from(key, 'hex');
        resolve(expected.length === derivedKey.length && crypto.timingSafeEqual(expected, derivedKey));
    });
});

async function ensureAccounts() {
    const defaults = [
        { role: 'admin', password: process.env.ADMIN_PASSWORD || 'admin123' },
        { role: 'garcom', password: process.env.WAITER_PASSWORD || 'garcom123' }
    ];
    for (const account of defaults) {
        if (!await Account.exists({ role: account.role })) {
            await new Account({ role: account.role, passwordHash: await hashPassword(account.password) }).save();
            if (!process.env[account.role === 'admin' ? 'ADMIN_PASSWORD' : 'WAITER_PASSWORD']) {
                console.warn(`ATENÇÃO: defina ${account.role === 'admin' ? 'ADMIN_PASSWORD' : 'WAITER_PASSWORD'} no arquivo .env e troque esta senha após o primeiro acesso.`);
            }
        }
    }
}

const sessions = new Map();
function createSession(role) {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { role, expiresAt: Date.now() + (8 * 60 * 60 * 1000) });
    return token;
}
function getSession(req) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const session = sessions.get(token);
    if (!session || session.expiresAt < Date.now()) { sessions.delete(token); return null; }
    return { token, ...session };
}

// ================= AUTENTICAÇÃO =================
app.post('/api/auth/login', async (req, res) => {
    try {
        const { role, password } = req.body;
        if (!['admin', 'garcom'].includes(role) || !password) return res.status(400).json({ error: 'Dados de acesso inválidos' });
        await ensureAccounts();
        const account = await Account.findOne({ role });
        if (!account || !await verifyPassword(password, account.passwordHash)) return res.status(401).json({ error: 'Senha incorreta' });
        res.json({ role, token: createSession(role) });
    } catch (error) { res.status(500).json({ error: 'Não foi possível validar o acesso' }); }
});

app.put('/api/auth/password', async (req, res) => {
    try {
        const session = getSession(req);
        if (!session || session.role !== 'admin') return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });
        const { currentPassword, newPassword } = req.body;
        if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'A nova senha deve ter pelo menos 8 caracteres.' });
        const account = await Account.findOne({ role: 'admin' });
        if (!account || !await verifyPassword(currentPassword || '', account.passwordHash)) return res.status(401).json({ error: 'Senha atual incorreta.' });
        account.passwordHash = await hashPassword(newPassword);
        account.updatedAt = new Date();
        await account.save();
        sessions.clear();
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Não foi possível alterar a senha' }); }
});

// Função auxiliar para abater do Clube automaticamente
async function processClubPaymentIfNeeded(paymentMethod, items, total) {
    if (paymentMethod && paymentMethod.startsWith('Clube - ')) {
        const clientName = paymentMethod.replace('Clube - ', '').trim();
        const customer = await Customer.findOne({ name: clientName });
        if (customer) {
            customer.clubBalance -= total;
            if (!customer.clubHistory) customer.clubHistory = [];
            customer.clubHistory.push({
                items: items,
                total: total,
                date: new Date()
            });
            await customer.save();
        }
    }
}

// ================= ROTAS DE CLIENTES E CLUBE =================
app.get('/api/customers', async (req, res) => {
    try { res.json(await Customer.find().sort({ name: 1 })); } 
    catch (error) { res.status(500).json({ error: 'Erro ao buscar clientes' }); }
});

app.post('/api/customers', async (req, res) => {
    try { res.status(201).json(await new Customer(req.body).save()); } 
    catch (error) { res.status(500).json({ error: 'Erro ao cadastrar cliente' }); }
});

app.put('/api/customers/:id/club', async (req, res) => {
    try {
        const { clubPlan, clubBalance } = req.body;
        const updated = await Customer.findByIdAndUpdate(req.params.id, { clubPlan, clubBalance }, { new: true });
        res.json(updated);
    } catch (error) { res.status(500).json({ error: 'Erro ao atualizar clube do cliente' }); }
});

app.get('/api/customers/club-extrato/:name', async (req, res) => {
    try {
        const customer = await Customer.findOne({ name: req.params.name });
        res.json(customer ? { clubPlan: customer.clubPlan, clubBalance: customer.clubBalance, clubHistory: customer.clubHistory || [] } : { clubPlan: 'Nenhum', clubBalance: 0, clubHistory: [] });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar extrato do clube' });
    }
});

app.delete('/api/customers/:id', async (req, res) => {
    try { await Customer.findByIdAndDelete(req.params.id); res.json({ success: true }); } 
    catch (error) { res.status(500).json({ error: 'Erro ao excluir cliente' }); }
});

app.get('/api/customers/debt/:name', async (req, res) => {
    try {
        const clientName = req.params.name;
        const orders = await Order.find({ 
            paymentMethod: { $regex: `Fiado - ${clientName}`, $options: 'i' },
            settled: { $ne: true }
        }).sort({ date: -1 });
        const customer = await Customer.findOne({ name: clientName });
        res.json({ orders, payments: customer ? customer.payments : [] });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar dívida' });
    }
});

app.post('/api/customers/debt/:name/pay', async (req, res) => {
    try {
        const { amount } = req.body;
        await Customer.findOneAndUpdate(
            { name: req.params.name },
            { $push: { payments: { amount, date: new Date() } } }
        );
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Erro ao registrar pagamento' }); }
});

app.post('/api/customers/debt/:name/settle', async (req, res) => {
    try {
        const clientName = req.params.name;
        await Order.updateMany(
            { paymentMethod: { $regex: `Fiado - ${clientName}`, $options: 'i' }, settled: { $ne: true } },
            { $set: { settled: true } }
        );
        await Customer.findOneAndUpdate({ name: clientName }, { $set: { payments: [] } });
        res.json({ success: true, msg: 'Conta quitada com sucesso!' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao quitar conta' });
    }
});

// ================= ROTAS DE CATEGORIAS =================
app.get('/api/categories', async (req, res) => res.json(await Category.find()));
app.post('/api/categories', async (req, res) => res.json(await new Category({ ...req.body, showOnline: true }).save()));
app.put('/api/categories/:id', async (req, res) => {
    try { res.json(await Category.findByIdAndUpdate(req.params.id, req.body, { new: true })); }
    catch (e) { res.status(500).json({ error: 'Erro ao atualizar categoria' }); }
});
app.delete('/api/categories/:id', async (req, res) => { await Category.findByIdAndDelete(req.params.id); res.json({ msg: 'OK' }); });

// ================= ROTAS DE PRODUTOS =================
app.get('/api/products', async (req, res) => res.json(await Product.find()));
app.post('/api/products', async (req, res) => res.json(await new Product(req.body).save()));
app.put('/api/products/:id', async (req, res) => { await Product.findByIdAndUpdate(req.params.id, req.body); res.json({ msg: 'Produto atualizado' }); });
app.delete('/api/products/:id', async (req, res) => { await Product.findByIdAndDelete(req.params.id); res.json({ msg: 'OK' }); });
app.get('/api/products/shopping-list', async (req, res) => {
    try {
        // Produtos criados antes do campo minStock usam 5 como padrão.
        const products = await Product.aggregate([
            { $addFields: { effectiveMinStock: { $ifNull: ['$minStock', 5] } } },
            { $match: { $expr: { $lte: ['$stock', '$effectiveMinStock'] } } },
            { $sort: { stock: 1, name: 1 } }
        ]);
        res.json(products.map(({ effectiveMinStock, ...product }) => ({ ...product, minStock: effectiveMinStock })));
    }
    catch (error) { res.status(500).json({ error: 'Erro ao gerar lista de compras' }); }
});

// ================= CAIXA =================
app.get('/api/cash-supplies', async (req, res) => {
    try {
        const start = req.query.date ? new Date(`${req.query.date}T00:00:00`) : new Date(); start.setHours(0, 0, 0, 0);
        const end = new Date(); end.setHours(23, 59, 59, 999);
        res.json(await CashSupply.find({ date: { $gte: start, $lte: end } }).sort({ date: -1 }));
    } catch (error) { res.status(500).json({ error: 'Erro ao buscar suprimentos' }); }
});
app.post('/api/cash-supplies', async (req, res) => {
    try {
        const amount = Number(req.body.amount);
        if (!amount || amount <= 0) return res.status(400).json({ error: 'Informe um valor maior que zero' });
        res.status(201).json(await new CashSupply({ amount, note: String(req.body.note || '') }).save());
    } catch (error) { res.status(500).json({ error: 'Erro ao registrar suprimento' }); }
});
app.get('/api/cash-expenses', async (req, res) => {
    try {
        const start = req.query.date ? new Date(`${req.query.date}T00:00:00`) : new Date(); start.setHours(0, 0, 0, 0);
        const end = new Date(start); end.setHours(23, 59, 59, 999);
        res.json(await CashExpense.find({ date: { $gte: start, $lte: end } }).sort({ date: -1 }));
    } catch (error) { res.status(500).json({ error: 'Erro ao buscar saídas de caixa' }); }
});
app.post('/api/cash-expenses', async (req, res) => {
    try {
        const amount = Number(req.body.amount); const description = String(req.body.description || '').trim();
        if (!amount || amount <= 0 || !description) return res.status(400).json({ error: 'Informe valor e descrição da saída' });
        res.status(201).json(await new CashExpense({ amount, description, category: String(req.body.category || 'Outros') }).save());
    } catch (error) { res.status(500).json({ error: 'Erro ao registrar saída de caixa' }); }
});

// ================= ROTAS DE MESAS =================
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
        if (!table) return res.status(404).json({ error: 'Mesa não encontrada' });
        if (req.body.requestId) {
            const existingOrder = await Order.findOne({ requestId: req.body.requestId });
            if (existingOrder) return res.json({ msg: 'Mesa já fechada', order: existingOrder, duplicate: true });
        }
        if (!Array.isArray(req.body.items) || !req.body.items.length || !Number(req.body.total) || Number(req.body.total) <= 0) return res.status(400).json({ error: 'Dados da comanda inválidos' });
        const newOrder = await new Order({ 
            items: req.body.items, 
            total: Number(req.body.total),
            paymentMethod: req.body.paymentMethod, 
            waiter: req.body.waiter || 'Garçom',
            orderType: 'table',
            saleType: 'comanda',
            tableName: table.name,
            requestId: req.body.requestId,
            settled: false,
            printed: false
        }).save();

        await processClubPaymentIfNeeded(req.body.paymentMethod, req.body.items, req.body.total);

        if (req.body.items && Array.isArray(req.body.items)) {
            for (let item of req.body.items) {
                if (item.id) await Product.findByIdAndUpdate(item.id, { $inc: { stock: -item.quantity } });
            }
        }
        table.items = []; table.status = 'livre'; await table.save();
        res.json({ msg: 'Mesa fechada', order: newOrder });
    } catch (error) { res.status(500).json({ error: 'Erro' }); }
});

app.put('/api/tables/:id/request-print', async (req, res) => {
    try { await Table.findByIdAndUpdate(req.params.id, { needsPrint: true }); res.json({ success: true }); }
    catch (error) { res.status(500).json({ error: 'Erro' }); }
});

app.get('/api/tables/pending-prints', async (req, res) => {
    try { res.json(await Table.find({ needsPrint: true })); }
    catch (error) { res.status(500).json({ error: 'Erro' }); }
});

app.put('/api/tables/:id/clear-print', async (req, res) => {
    try { await Table.findByIdAndUpdate(req.params.id, { needsPrint: false }); res.json({ success: true }); }
    catch (error) { res.status(500).json({ error: 'Erro' }); }
});

// ================= ROTAS DE PEDIDOS E HISTÓRICO =================
app.post('/api/orders', async (req, res) => {
    try {
        if (req.body.requestId) {
            const existingOrder = await Order.findOne({ requestId: req.body.requestId });
            if (existingOrder) return res.json({ msg: 'Pedido já registrado', order: existingOrder, duplicate: true });
        }
        const total = Number(req.body.total);
        if (!Array.isArray(req.body.items) || !req.body.items.length || !Number.isFinite(total) || total <= 0) return res.status(400).json({ error: 'Dados da venda inválidos' });
        const newOrder = await new Order({ ...req.body, total, settled: false, printed: false }).save();
        
        await processClubPaymentIfNeeded(req.body.paymentMethod, req.body.items, req.body.total);

        if (req.body.items && Array.isArray(req.body.items)) {
            for (let item of req.body.items) {
                if (item.id) await Product.findByIdAndUpdate(item.id, { $inc: { stock: -item.quantity } });
            }
        }
        res.json({ msg: 'Pedido salvo', order: newOrder });
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

app.get('/api/orders/pending', async (req, res) => {
    try { res.json(await Order.find({ printed: false }).sort({ date: 1 })); }
    catch (error) { res.status(500).json({ error: 'Erro' }); }
});

app.put('/api/orders/:id/printed', async (req, res) => {
    try { await Order.findByIdAndUpdate(req.params.id, { printed: true }); res.json({ success: true }); }
    catch (error) { res.status(500).json({ error: 'Erro' }); }
});

app.put('/api/orders/:id/confirm-payment', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
        order.paymentMethod = order.paymentMethod.replace('Pendente (Aguardando Confirmação)', `Recebido: ${req.body.method}`);
        await order.save();
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Erro ao confirmar pagamento' }); }
});

app.delete('/api/orders/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ error: 'Venda não encontrada' });

        if (order.items && Array.isArray(order.items)) {
            for (let item of order.items) {
                if (item.id) {
                    await Product.findByIdAndUpdate(item.id, { $inc: { stock: item.quantity } });
                }
            }
        }

        await Order.findByIdAndDelete(req.params.id);
        res.json({ success: true, msg: 'Venda excluída com sucesso' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao excluir venda' });
    }
});

// ================= ROTAS PIX =================
app.post('/api/pix', async (req, res) => {
    try {
        const result = await payment.create({
            body: { transaction_amount: req.body.total, description: 'Venda Conteiner Beer', payment_method_id: 'pix', payer: { email: 'cliente@conteinerbeer.com' } }
        });
        res.json({ id: result.id, qr_code_base64: result.point_of_interaction.transaction_data.qr_code_base64 });
    } catch (error) { res.status(500).json({ error: 'Erro ao gerar PIX' }); }
});
app.get('/api/pix/:id', async (req, res) => { try { res.json({ status: (await payment.get({ id: req.params.id })).status }); } catch (error) { res.status(500).json({ error: 'Erro' }); } });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
