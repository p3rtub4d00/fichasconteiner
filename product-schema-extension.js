// Extensão compatível do schema Product para armazenar imagem personalizada.
// O arquivo é carregado antes do server.js pelo script de start.
const mongoose = require('mongoose');

const originalModel = mongoose.model.bind(mongoose);
mongoose.model = function patchedModel(name, schema, options) {
    if (name === 'Product' && schema && typeof schema.add === 'function' && !schema.path('imageUrl')) {
        schema.add({
            imageUrl: { type: String, default: '' }
        });
    }
    return originalModel(name, schema, options);
};
