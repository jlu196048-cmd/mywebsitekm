const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('admin123', 10);
console.log(hash);
const r = bcrypt.compareSync('admin123', '$2a$10$X7X0qb1m.IXJ4HTa7n8oQOd2qf7.VIaCm/Im6bqUfk8gGdFsXnXpi');
console.log('hash matches:', r);
