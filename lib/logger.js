module.exports = process.env.NODE_ENV === 'test' ? console.log.bind(null, new Date()) : function(){};
