'use strict';

const fs = require('fs');
const EventEmitter = require('events').EventEmitter;
const Proxy = require('./Proxy');


class Proxies extends EventEmitter {
    /**
     * @param {{threads?: number, db?: string}} config
     */
    constructor(config = {}) {
        super();
        
        this._proxies = [];
        this._threads = config.threads || 0;
        this._dbPath = config.db || (__dirname + '/db');
        this._updates = 0;
        this._updateQueue = [];
    }
    
    /**
     * @param {string} path
     */
    load(path) {
        let file = fs.readFileSync(path, 'utf8').trim().split('\n');
        
        for (let line of file) {
            let [p1, p2] = line.trim().split('@');
            let host, port, username = null, password = null;
    
            p1 = p1.split(':');
            if (p2) {
                p2 = p2.split(':');
                username = p1[0];
                password = p1[1];
                host = p2[0];
                port = parseInt(p2[1]);
            } else {
                host = p1[0];
                port = parseInt(p1[1]);
            }
    
            /**
             * @type {Proxy|EventEmitter}
             */
            let proxy = new Proxy({host, port, username, password, db: this._dbPath});
            let found = false;
            
            for (let p of this._proxies) {
                if (p.url === proxy.url) {
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                this._proxies.push(proxy);
                proxy.on('allocate', this.emit.bind(this, 'allocate', proxy));
                proxy.on('free', this.emit.bind(this, 'free', proxy));
                proxy.on('update', this.emit.bind(this, 'update', proxy));
                proxy.on('alive', this.emit.bind(this, 'alive', proxy));
                proxy.on('dead', this.emit.bind(this, 'dead', proxy));
                
                this._updateProxy(proxy);
            }
        }
    }
    
    allocate() {
        let proxy = this.getFreeProxy();
        if (!proxy) throw new Error('There is no free proxy to allocate.');
        
        proxy.allocate();
    }
    
    getFreeProxy() {
        for (let p of this._proxies) {
            if (p.free) return p;
        }
        
        return null;
    }
    
    _updateProxy(proxy) {
        if (proxy && this._updates >= this._threads) {
            this._updateQueue.push(proxy);
            return;
        }
        if (!proxy && this._updateQueue.length) proxy = this._updateQueue.shift();
        else if (!proxy) return;
        
        this._updates ++;
        
        let cb = () => {
            setTimeout(() => this._updateProxy(proxy), 2000);
            this._updates --;
            this._updateProxy();
        };
        
        proxy.update().then(cb).catch(cb);
    }
}


module.exports = Proxies;
