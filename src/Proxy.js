'use strict';

const fs = require('fs');
const EventEmitter = require('events').EventEmitter;
const request = require('request-promise');
const maxmind = require('maxmind').openSync(__dirname + '/../maxmind.mmdb');


class Proxy extends EventEmitter {
    /**
     * @param {{host: string, port: number|string, username?: string|null, password?: string|null, db?: string}} config
     */
    constructor(config) {
        super();
        
        this._host = config.host || null;
        this._port = config.port || null;
        this._username = config.username || null;
        this._password = config.password || null;
    
        this._dbPath = config.db || (__dirname + '/db');
        
        if (!this._host || !this._port) throw new Error('Host and port are required.');
        
        this._port = parseInt(this._port);
        if (isNaN(this._port)) throw new Error('Port must be an integer.');
    
        this._address = null;
        this._alive = false;
        this._free = true;
        this._used = false;
        this._saved = false;
    }
    
    allocate() {
        this._free = false;
        this.use();
        this.emit('allocate');
    }
    
    unleash() {
        this._free = true;
        this.emit('free');
    }
    
    burn() {
        this._used = true;
    }
    
    use() {
        if (this._saved || this._used || this._saved || !this._address) return;
    
        this._saved = true;
        
        let split = this._address.split('.');
        let file = this._dbPath + '/' + split[0] + '-' + split[1] + '.txt';
        fs.appendFileSync(file, this._address + '\n', 'utf8');
    }
    
    async update() {
        let address = null;
        
        try {
            address = await request({
                url: 'http://api.ipify.org',
                proxy: this.url,
                timeout: 10000,
            });
        } catch (e) {
            address = null;
        }
        
        let alive = !!address;
    
        let state = (alive !== this._alive);
        let update = (this._address !== address);
    
        this._time = Date.now();
        this._alive = alive;
        if (address) this._address = address;
        
        if (update) {
            this._used = false;
            this._saved = false;
            
            if (address) {
                let l = maxmind.get(address);
                this._country = l ? l.country['iso_code'].toLowerCase() : 'uu';
                
                let split = address.split('.');
                let file = this._dbPath + '/' + split[0] + '-' + split[1] + '.txt';
                this._used = (fs.existsSync(file) && fs.readFileSync(file).indexOf(address + '\n') !== -1);
                this._saved = this._used;
                
                if (!this._free) this.use();
            }
            
            this.emit('update');
        }
        
        if (state) {
            if (alive) this.emit('alive');
            else this.emit('dead');
        }
    }
    
    /**
     * @return {string}
     */
    get host() {
        return this._host;
    }
    
    /**
     * @return {number}
     */
    get port() {
        return this._port;
    }
    
    /**
     * @return {string|null}
     */
    get username() {
        return this._username;
    }
    
    /**
     * @return {string|null}
     */
    get password() {
        return this._password;
    }
    
    /**
     * @return {string|null}
     */
    get address() {
        return this._address;
    }
    
    /**
     * @return {string|null}
     */
    get country() {
        return this._country;
    }
    
    /**
     * @return {number}
     */
    get time() {
        return this._time;
    }
    
    /**
     * @return {boolean}
     */
    get alive() {
        return this._alive;
    }
    
    /**
     * @return {boolean}
     */
    get free() {
        return this._free;
    }
    
    /**
     * @return {boolean}
     */
    get used() {
        return this._used;
    }
    
    /**
     * @return {string}
     */
    get url() {
        return `http://${this._username ? `${this._username}:${this._password}@` : ''}${this._host}:${this._port}`;
    }
}


module.exports = Proxy;