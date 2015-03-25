Bitcoin = bitcoin

function bytesToBase64(bytes) {
    var base64map = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    var base64 = []

    for (var i = 0; i < bytes.length; i += 3) {
        var triplet = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]

        for (var j = 0; j < 4; j++) {
            if (i * 8 + j * 6 <= bytes.length * 8) {
                base64.push(base64map.charAt((triplet >>> 6 * (3 - j)) & 0x3F))
            } else {
                base64.push('=')
            }
        }
    }
    return base64.join('')
}


login = function(priv, bitidUrl) {
    var isDev = true
    var httpUrl = bitidUrl.replace('bitid:', isDev ? 'http:' : 'https:')

    var addr = priv.pub.getAddress()
    addr.version = 0
    addr = addr.toString()
    //console.log(addr)

    var sign = Bitcoin.Message.sign(priv, bitidUrl, Bitcoin.networks.bitcoin)
    var res = Bitcoin.Message.verify(addr, sign, httpUrl, Bitcoin.networks.bitcoin)
    console.log('VERIFIED ', res)

    var sign64 = bytesToBase64(sign)
    console.log(sign64)

    var req = new XMLHttpRequest()
    req.open("POST", httpUrl);
    req.setRequestHeader("Content-Type", "application/json") //;charset=UTF-8")

    var data = JSON.stringify({
        "uri": bitidUrl,
        "address": addr,
        "signature": sign64
    })

    req.onload = function(e) {
        if (req.readyState === 4) {
            if (req.status === 200) {
                console.log(req.responseText)
            } else {
                console.error(req.statusText)
            }
        }
    }
    req.onerror = function(e) {
        console.error(e)
    }

    req.send(data)
}

$(document).ready(function() {
    $('body').on('click', 'a', function(e) {
        var href = $(this).attr('href')

        var authUrlLocal = 'http://localhost:2345/auth/facebook'
        var authUrlRemote = 'http://giveaway.coinawesome.com/auth/facebook'
        var authUrlRemoteS = 'https://giveaway.coinawesome.com/auth/facebook'

        if (href.substr(0, 8) === 'bitid://') {
            console.log('BitId link detected: ', href)
            // just for testing - TODO change with real one
            var priv = new Bitcoin.ECKey.makeRandom(false)
            login(priv, href)
            return false
        } else if (href === authUrlLocal || href === authUrlRemote || href === authUrlRemoteS) {


            href = authUrlRemote + '/' + wallet.getAddress()
            if (href === authUrlRemoteS) {
                href = authUrlRemoteS + '/' + wallet.getAddress()
            } else if (href === authUrlRemote) {
                href = authUrlRemote + '/' + wallet.getAddress()
            } else {
                href === authUrlLocal
            }

            var refAddr = $(this).attr('refAddr')
            if (refAddr) {
                href = href + '-' + refAddr
            }

            $(this).attr('href', href)
            return true
        } else {
            // Return true if not a bitid link so click will work normally
            return true
        }
    })
})