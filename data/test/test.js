/**
 * test.js
 * Copyright (c) 2014 Mr. Awesome
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the MIT license.
 */

describe('util', function() {

    it('should get bitcoinaverage', function(done) {
        util.getJSON('https://api.bitcoinaverage.com/ticker/USD').then(function(json) {
            expect(json['24h_avg']).toBeGreaterThan(0);
            done();
        }, function() {
            expect(true).toBe(false);
            done();
        });
    });

    it('should get blockchain.info', function(done) {
        var address = '1LpYHfSfUrSPRMuEas7WjzDMxm2Qrk9yBk';
        util.get('https://blockchain.info/q/addressbalance/' + address).then(function(response) {
            expect(response).toBeGreaterThan(-1);
            done();
        }, function() {
            expect(true).toBe(false);
            done();
        });
    });

    it('should post blockchain.info', function(done) {
        var data = 'tx=';
        util.post('https://blockchain.info/pushtx', data).then(function(response) {
            expect(response.status).toEqual(200);
            done();
        }, function(e) {
            expect(e.message.length).toBeGreaterThan(0);
            done();
        });
    });

    it('should open paypopup iframe', function(done) {
        util.iframe('paypopup.html').then(function(iframe) {
            expect(iframe.contentWindow.document.getElementById('progress')).not.toBeUndefined();
            done();
        }, function() {
            expect(true).toBe(false);
            done();
        });
    });

    it('should open hoverpopup iframe', function(done) {
        util.iframe('hoverpopup.html').then(function(iframe) {
            expect(iframe.contentWindow.document.getElementById('progress')).not.toBeUndefined();
            done();
        }, function() {
            expect(true).toBe(false);
            done();
        });
    });

    // Only Firefox
    if (navigator.userAgent.toLowerCase().indexOf('firefox') > -1) {
        it('should return a message', function(done) {
            util.message('save', {}).then(function(response) {
                expect(response).not.toBeNull();
                done();
            }, function() {
                expect(true).toBe(false);
                done();
            });
        });
    }
});

describe('preferences', function() {

    it('should get and set address', function(done) {
        var address;
        preferences.getAddress().then(function(_address) {
            address = _address;
            return preferences.setAddress('new address');
        }).then(function() {
            return preferences.getAddress();
        }).then(function(_address) {
            expect(_address).toEqual('new address');
            return preferences.setAddress(address);
        }).then(function() {
            done();
        }).catch(function() {
            expect(true).toBe(false);
            done();
        });
    });

    it('should get and set currency', function(done) {
        var currency;
        preferences.getCurrency().then(function(_currency) {
            currency = _currency;
            return preferences.setCurrency('ABC');
        }).then(function() {
            return preferences.getCurrency();
        }).then(function(_currency) {
            expect(_currency).toEqual('ABC');
            return preferences.setCurrency(currency);
        }).then(function() {
            done();
        }).catch(function() {
            expect(true).toBe(false);
            done();
        });
    });
});

describe('currencyManager', function() {

    it('should update exchange rate', function(done) {
        currencyManager.updateExchangeRate().then(function() {
            return preferences.getExchangeRate();
        }).then(function(rate) {
            expect(rate).toBeGreaterThan(0);
            done();
        }).catch(function() {
            expect(true).toBe(false);
            done();
        });
    });

    it('should format the money', function(done) {
        currencyManager.formatAmount(100000000).then(function(formattedAmount) {
            expect(/^\$\d+\.\d{2}$/.test(formattedAmount)).toBe(true);
            done();
        }).catch(function() {
            expect(true).toBe(false);
            done();
        });
    });
});

describe('wallet', function() {

    it('should generate, restore and import private keys', function(done) {
        var privateKey;
        wallet.generateAddress().then(function() {
            privateKey = wallet.getDecryptedPrivateKey();
            expect(privateKey.length).toBeGreaterThan(0);
            return wallet.restoreAddress();
        }).then(function() {
            expect(privateKey).toBe(wallet.getDecryptedPrivateKey());
            return wallet.generateAddress();
        }).then(function() {
            expect(privateKey).not.toBe(wallet.getDecryptedPrivateKey());
            expect(wallet.getDecryptedPrivateKey().length).toBeGreaterThan(0);
            return wallet.importAddress(null, privateKey);
        }).then(function() {
            expect(privateKey).toBe(wallet.getDecryptedPrivateKey());
            done();
        }).catch(function() {
            expect(true).toBe(false);
            done();
        });
    });

    it('should generate, restore and import encrypted private keys', function(done) {
        var privateKey,
            password = 'password';
        wallet.generateAddress().then(function() {
            privateKey = wallet.getDecryptedPrivateKey();
            expect(privateKey.length).toBeGreaterThan(0);
            return wallet.updatePassword(null, password);
        }).then(function() {
            expect(privateKey).toBe(wallet.getDecryptedPrivateKey(password));
            return wallet.generateAddress(password);
        }).then(function() {
            expect(privateKey).not.toBe(wallet.getDecryptedPrivateKey(password));
            expect(wallet.getDecryptedPrivateKey(password).length).toBeGreaterThan(0);
            return wallet.importAddress(password, privateKey);
        }).then(function() {
            expect(privateKey).toBe(wallet.getDecryptedPrivateKey(password));
            return wallet.updatePassword(password);
        }).then(function() {
            expect(privateKey).toBe(wallet.getDecryptedPrivateKey());
            done();
        }).catch(function() {
            expect(true).toBe(false);
            done();
        });
    });

    it('should fail with insufficient funds', function(done) {
        wallet.send('', 1, 1).then(function() {
            expect(true).toBe(false);
            done();
        }, function(e) {
            expect(e.message).toBe('No free outputs to spend');
            done();
        });
    });

});