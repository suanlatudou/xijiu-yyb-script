const $ = new Env('习酒');
const axios = require('axios');
let request = require("request");
let CryptoJS = require("crypto-js")
request = request.defaults({
    jar: true
});
const {
    log
} = console;
//process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
const Notify = 0; //0为关闭通知，1为打开通知,默认为1
const debug = 0; //0为关闭调试，1为打开调试,默认为0
let xjhd = ($.isNode() ? process.env.xjhd : $.getdata("xjhd")) || ""
let xjauth = ($.isNode() ? process.env.xjauth : $.getdata("xjauth")) || ""
let xjhdArr = [];
let xjauthArr = [];
let data = '';
let msg = '';
let indexlist = [];
let total = 0;
var hours = new Date().getMonth();
let jwts = ''
var timestamp = Math.round(new Date().getTime()).toString();

// ========== 补充全局变量声明，修复隐式全局污染 ==========
let enckey, enciv, encver, encts;
let member_id = '';
let water, manure, sorghum, wheat, wine_yeast, wine;
let volumns = 0;
let cryptoAvailable = false;
let tokenExpired = false;

const GARDEN_APPID = "wx489f950decfeb93e";
const YYB_SERVER = String(process.env.YYB_SERVER || "http://127.0.0.1:8000").replace(/\/$/, "");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13) UnifiedPCWindowsWechat(0xf254181d) XWEB/19201";
let gardenToken = "";
let loginCode = "";
let yybRef = "1";

function hd(extra = {}) {
    return {
        "AppID": GARDEN_APPID,
        "App-Version": "1.7",
        "User-Agent": UA,
        "Content-Type": extra["Content-Type"] || "application/json",
        "Referer": `https://servicewechat.com/${GARDEN_APPID}/215/page-frame.html`,
        ...(gardenToken ? { "Authorization": gardenToken } : { "Authorization": "Basic d2VjaGF0OndlY2hhdF9zZWNyZXQ=" }),
        ...(loginCode ? { "login_code": loginCode } : {}),
        ...extra,
    };
}

async function yybPost(path, body) {
    const res = await axios.request({
        method: "POST",
        url: YYB_SERVER + path,
        headers: { "Content-Type": "application/json" },
        data: body,
        timeout: 30000,
        validateStatus: () => true,
    });
    return res.data;
}

async function yybGetCode() {
    const r = await yybPost("/wxapp/getCode", { ref: String(yybRef), app_id: GARDEN_APPID });
    const code = r?.data?.result?.code;
    if (!code) throw new Error("YYB getCode 失败: " + JSON.stringify(r));
    return code;
}

async function yybLogin() {
    const code1 = await yybGetCode();
    const sess = await axios.request({
        method: "GET",
        url: "https://xcx.exijiu.com/anti-channeling/public/index.php/api/v2/auth/session?code=" + encodeURIComponent(code1),
        headers: hd({ Authorization: "Basic d2VjaGF0OndlY2hhdF9zZWNyZXQ=" }),
        timeout: 15000,
        validateStatus: () => true,
    });
    loginCode = sess.data?.data?.login_code || sess.data?.data?.loginCode || "";
    if (!loginCode) throw new Error("login_code 失败: " + JSON.stringify(sess.data));

    const code2 = await yybGetCode();
    const lg = await axios.request({
        method: "GET",
        url: "https://apimallwm.exijiu.com/garden/wechat/login?code=" + encodeURIComponent(code2),
        headers: hd({ Authorization: "Basic d2VjaGF0OndlY2hhdF9zZWNyZXQ=" }),
        timeout: 15000,
        validateStatus: () => true,
    });
    gardenToken = lg.data?.data?.authorized_token || "";
    if (!gardenToken) throw new Error("garden 登录失败: " + JSON.stringify(lg.data));
    jwts = gardenToken;
    xjhd = gardenToken;
    log("[+] YYB garden 登录成功");
}

async function yybCrypto() {
    const r = await yybPost("/wxapp/operateWxData", {
        ref: String(yybRef),
        app_id: GARDEN_APPID,
        payload: { api_name: "webapi_getuserencryptkey", data: {} },
    });
    const inner = JSON.parse(r?.data?.result?.data || "{}");
    if (!inner.encrypt_key || !inner.iv || inner.version == null) {
        throw new Error("YYB encryptkey 失败: " + JSON.stringify(r));
    }
    enckey = inner.encrypt_key;
    enciv = inner.iv;
    encver = inner.version;
    encts = Date.now().toString();
    cryptoAvailable = true;
    log(`[+] YYB 密钥 version=${encver}`);
}

function isTokenExpiredMsg(v) {
  const x = String(v || "").toLowerCase();
  return x.includes("token无效") || x.includes("token已过期") || x.includes("token无效或已过期") || x === "401";
}

!(async () => {
    if (typeof $request !== "undefined") {
        await GetRewrite();
    } else {
        if (!(await Envs()))
            return;
        else {

            log(`\n\n=============================================    \n脚本执行 - 北京时间(UTC+8)：${new Date(
                new Date().getTime() + new Date().getTimezoneOffset() * 60 * 1000 +
                8 * 60 * 60 * 1000).toLocaleString()} \n=============================================\n`);
            log(`\n============ 微信公众号：柠檬Plus ============`)
            log(`\n=================== 共找到 ${xjhdArr.length} 个账号 ===================`)
            if (debug) {
                log(`【debug】 这是你的全部账号数组:\n ${xjhdArr}`);
            }
            for (let index = 0; index < xjhdArr.length; index++) {

                let num = index + 1
                addNotifyStr(`\n==== 开始【第 ${num} 个账号】====\n`, true)

                xjhd = xjhdArr[index];
                yybRef = xjhdArr[index];
                gardenToken = "";
                loginCode = "";
                jwts = "";
                cryptoAvailable = false;
                tokenExpired = false;
                await getcrypto()

            }
            await SendMsg(msg);
        }
    }
})()
    .catch((e) => log(e))
    .finally(() => $.done())

/**
 * 获取地块列表
 */
async function sorghumindex1() {
    return new Promise((resolve) => {
        const options = {
            method: 'GET',
            url: 'https://apimallwm.exijiu.com/garden/sorghum/index',
            headers: hd(),
        };
        if (debug) log(`\n【debug】地块请求参数：${JSON.stringify(options)}`);

        axios.request(options)
            .then((response) => {
                const data = response.data;
                if (debug) log(`\n【debug】地块接口返回：${JSON.stringify(data)}`);
                if (data.err === 0) {
                    indexlist = data.data;
                    total = data.total;
                    // 保存会员ID给埋点接口用
                    if (data.data.length > 0 && data.data[0].member_id) {
                        member_id = data.data[0].member_id;
                    }
                } else {
                    if (isTokenExpiredMsg(data.msg)) {
                      tokenExpired = true;
                      log("[!] 检测到 Token 无效或已过期");
                    }
                    log(`地块接口失败：${data.msg}`);
                    indexlist = [];
                    total = 0;
                }
            })
            .catch((err) => {
                log(`地块请求异常：${err.message}`);
                indexlist = [];
                total = 0;
            })
            .finally(() => {
                resolve();
            });
    })
}

/**
 * 获取仓库库存信息
 * ✅ 修复点：then回调加上 async，解决第151行语法错误
 */
async function getMemberInfo1(runCryptoTasks = true) {
    return new Promise((resolve) => {
        const options = {
            method: 'GET',
            url: 'https://apimallwm.exijiu.com/garden/Gardenmemberinfo/getMemberInfo',
            headers: hd(),
        };
        if (debug) log(`\n【debug】库存请求参数：${JSON.stringify(options)}`);

        axios.request(options)
            .then(async (response) => { // ✅ 这里加上 async，修复 await 语法错误
                try {
                    const data = response.data;
                    if (debug) log(`\n【debug】库存接口返回：${JSON.stringify(data)}`);
                    if (data.err === 0) {
                        const info = data.data;
                        // 同步全局库存变量
                        water = info.water;
                        manure = info.manure;
                        sorghum = info.sorghum;
                        wheat = info.wheat;
                        wine_yeast = info.wine_yeast;
                        wine = info.wine;

                        const stock = {
                            water: info.water,
                            manure: info.manure,
                            sorghum: info.sorghum,
                            wheat: info.wheat,
                            wine_yeast: info.wine_yeast,
                            wine: info.wine,
                            integration: info.integration
                        };
                        log(`积分：${stock.integration} 高粱：${stock.sorghum} 小麦：${stock.wheat} 酒曲：${stock.wine_yeast} 水：${stock.water} 酒：${stock.wine}`);
                        msg += `\n积分：${stock.integration}\n高粱：${stock.sorghum}\n小麦：${stock.wheat}\n肥料：${stock.manure}\n酒曲：${stock.wine_yeast}\n水：${stock.water}\n酒：${stock.wine}`;

                        if (runCryptoTasks) {
                            await handleFarmLand(stock);
                            await globalStockTask(stock);
                        }
                    } else {
                        if (isTokenExpiredMsg(data.msg)) {
                          tokenExpired = true;
                          log("[!] 检测到 Token 无效或已过期");
                        }
                        log(`库存接口失败：${data.msg}`);
                    }
                } catch (e) {
                    log(`库存处理异常：${e.message}`);
                }
            })
            .catch((err) => {
                log(`库存请求异常：${err.message}`);
            })
            .finally(() => {
                resolve();
            });
    })
}

/**
 * 处理每一块农田循环逻辑
 * @param {Object} stock 库存对象
 */
async function handleFarmLand(stock) {
    if (!Array.isArray(indexlist) || indexlist.length === 0) {
        log("暂无地块数据，跳过处理");
        return;
    }
    for (const item of indexlist) {
        try {
            const { status, serial_number } = item;
            if (status === -1) continue;
            if (!item.id || !item.type) {
                log(`${serial_number}号田数据残缺，跳过`);
                continue;
            }

            const { id, member_id: mid, volumn, water_num, create_time, crop_time, type } = item;
            let currentStatus = status;

            let cropName = type === 1 ? "高粱" : "小麦";
            const landText = `${serial_number}号田 ${cropName}\n种植时间：${create_time}\n成熟时间：${crop_time}`;
            log(landText);
            msg += "\n" + landText;
            log(`地块ID:${id} 会员ID:${mid}`);

            // 第一步：成熟先收获
            if (currentStatus === 2 || currentStatus === 10 || currentStatus === 11) {
                await harvestAll();
                log("=====================================");
                currentStatus = 0; // 收获后置为空地状态
            }

            // 第二步：空地播种（非锁定状态）
            if (currentStatus !== 11 && currentStatus !== 10 && currentStatus !== 2) {
                const seedType = wine_yeast === 0 ? 2 : 1;
                await seed(id, seedType);
            }

            // 第三步：浇水关闭
            if (false && water_num > 0 && stock.water > 0) {
                const maxTimes = Math.min(water_num, 10);
                for (let j = 0; j < maxTimes; j++) {
                    await watering(id);
                    await $.wait(5000)
                }
            }
        } catch (e) {
            log(`地块${item.serial_number}处理异常：${e.message}`);
            continue;
        }
    }
}

/**
 * 地块循环结束后的全局库存任务
 * @param {Object} stock 库存
 */
async function globalStockTask(stock) {
    // 酒兑换积分：先关掉，确认农场跑通后再开
    if (false && stock.wine > 0) {
        await exchange(stock.wine);
    }
    // 小麦足够做酒曲
    if (stock.wheat >= 100) {
        await makeWineYeast();
    }
    // 查询酿酒状态
    await gardenmemberwine();
    // 高粱充足且有酒曲则酿酒
    if (stock.sorghum >= 200 && stock.wine_yeast > 0) {
        await makeWine();
    }
}

// 主执行入口
async function main() {
    msg = "";
    await sorghumindex1();
    await getMemberInfo1();
    log("=====本轮农场任务执行完毕=====");
}

/**
 * 缺少 AES 密钥时仍可执行的 H5 旧接口任务。
 * 这些接口只需要有效 Token，不需要 ts/encryptData/version。
 */
async function mainWithoutCrypto() {
    msg = "";
    log("[i] AES 密钥不可用，执行无需加密的查询/酿酒任务");
    tokenExpired = false;
    await sorghumindex1();
    if (tokenExpired) {
      log("[!] Token 已失效，停止当前账号剩余任务");
      return;
    }
    await getMemberInfo1(false);
    if (tokenExpired) {
      log("[!] Token 已失效，停止当前账号剩余任务");
      return;
    }

    if (!(await getGardenJwt())) {
        log("[!] 获取网页农场 JWT 失败，本轮只完成查询，跳过收酒/制曲/制酒");
        return;
    }

    const hasActiveWine = await gardenmemberwine();

    if (Number(wheat) >= 100) {
        const yeastMade = false; log("[query-only] 跳过制曲");
        if (yeastMade) {
            wine_yeast = Number(wine_yeast || 0) + 10;
        }
    }

    if (!hasActiveWine && Number(sorghum) >= 200 && Number(wine_yeast) > 0) {
        log("[query-only] 跳过制酒");
    }

    log("=====无需 AES 的任务执行完毕=====");
    log("[i] 浇水、播种、收高粱、农场签到和兑换积分已跳过");
}

async function getcrypto() {
    try {
        log(`[i] YYB_SERVER=${YYB_SERVER} ref=${yybRef}`);
        await yybLogin();
        await yybCrypto();
        await getGardenJwt();
        await Gardenmemberwine();
        await main();
        await dailySign();
        await Sign();
        await tasks();
        await recommend();
        return;
    } catch (e) {
        cryptoAvailable = false;
        log(`[!] YYB 登录/密钥失败: ${e.message || e}`);
        log("[i] 回退 RCP 8890");
    }

    return new Promise((resolve) => {
        var options = {
            method: 'GET',
            url: 'http://127.0.0.1:8890/api/crypto',
            validateStatus: () => true,
            headers: {
                'Content-Type': 'application/json',
            },
        };
        axios.request(options).then(async function (response) {
            try {
                data = response.data;
                if (data.code == 0) {
                    cryptoAvailable = true
                    enckey = data.data.key
                    enciv = data.data.iv
                    encver = data.data.version
                    encts = data.data.ts
                    await getGardenJwt()
                    await Gardenmemberwine()
                    await main()
                    await dailySign()
                    await Sign()
                    await tasks()
                    await recommend()
                } else {
                    cryptoAvailable = false
                    log(data.msg)
                    await mainWithoutCrypto()
                }
            } catch (e2) {
                log(`异常：${e2.message || e2}`)
                await mainWithoutCrypto()
            }
        }).catch(function (error) {
            console.error(error);
            mainWithoutCrypto().then(() => resolve());
            return;
        }).then(res => {
            resolve();
        });
    })
}

async function dailySign() {
    encts = Date.now().toString();
    return new Promise((resolve) => {
        var options = {
            method: 'POST',
            url: 'https://apimallwm.exijiu.com/garden/sign/dailySign',
            headers: hd(),
            data: {
                "encryptData": AES_Encrypt('{"ts":' + encts + '}', enckey, enciv),
                "ts": encts,
                "version": encver
            },
        };
        if (debug) {
            log(`\n【debug】=============== 这是  请求 url ===============`);
            log(JSON.stringify(options));
        }
        axios.request(options).then(async function (response) {
            try {
                data = response.data;
                if (debug) {
                    log(`\n\n【debug】===============这是 返回data==============`);
                    log(JSON.stringify(response.data));
                }
                if (data.err == 0) {
                    if (data.data.isTodayFirstSign == false) {
                        log('今日已签到')
                    } else
                        if (data.data.isTodayFirstSign == true) {
                            log('签到')
                            await Sign()
                        }
                } else log(data.msg)
            } catch (e) {
                log(JSON.stringify(response.data));
                log(`异常：${JSON.stringify(response.data)}，原因：${data.msg}`)
            }
        }).catch(function (error) {
            console.error(error);
        }).then(res => {
            resolve();
        });
    })
}

async function Sign() {
    return new Promise((resolve) => {
        var options = {
            method: 'POST',
            url: 'https://apimallwm.exijiu.com/member/signin/sign',
            headers: hd(),
            data: 'from=miniprogram_index'
        };
        if (debug) {
            log(`\n【debug】=============== 这是  请求 url ===============`);
            log(JSON.stringify(options));
        }
        axios.request(options).then(async function (response) {
            try {
                data = response.data;
                if (debug) {
                    log(`\n\n【debug】===============这是 返回data==============`);
                    log(JSON.stringify(response.data));
                }
                if (data.err == 0) {
                    log("signin：" + data.msg)
                } else log(data.msg)
            } catch (e) {
                log(`异常：${data}，原因：${data.msg}`)
            }
        }).catch(function (error) {
            console.error(error);
        }).then(res => {
            resolve();
        });
    })
}

async function tasks() {
    return new Promise((resolve) => {
        var options = {
            method: 'GET',
            url: 'https://apimallwm.exijiu.com/garden/tasks/index',
            headers: hd(),
        };
        if (debug) {
            log(`\n【debug】=============== 这是  请求 url ===============`);
            log(JSON.stringify(options));
        }
        axios.request(options).then(async function (response) {
            try {
                data = response.data;
                if (debug) {
                    log(`\n\n【debug】===============这是 返回data==============`);
                    log(JSON.stringify(response.data));
                }
                if (data.err == 0) {
                    if (data.data[0].is_complete == 1) {
                        log('今日已答题')
                    } else
                        if (data.data[0].is_complete == 0) {
                            await questiontask()
                        }
                    await dailyShare()
                    if (data.data[2].is_complete == 1) {
                        log('今日已查看')
                    } else
                        if (data.data[2].is_complete == 0) {
                            await realscene()
                        }
                } else log(data.msg)
            } catch (e) {
                //  log(`异常：${data}，原因：${data.msg}`)
            }
        }).catch(function (error) {
            console.error(error);
        }).then(res => {
            resolve();
        });
    })
}

async function questiontask() {
    return new Promise((resolve) => {
        var options = {
            method: 'GET',
            url: 'https://apimallwm.exijiu.com/garden/Gardenquestiontask/index',
            headers: hd(),
        };
        if (debug) {
            log(`\n【debug】=============== 这是  请求 url ===============`);
            log(JSON.stringify(options));
        }
        axios.request(options).then(async function (response) {
            try {
                data = response.data;
                if (debug) {
                    log(`\n\n【debug】===============这是 返回data==============`);
                    log(JSON.stringify(response.data));
                }
                if (data.err == 0) {
                    ansid = data.data[0].id
                    answer = data.data[0].answer
                    console.log(data.data[0].title)
                    console.log("答案为：" + answer)
                    await answerResults(ansid, answer)
                } else log(data.msg)
            } catch (e) {
                log(`异常：${data}，原因：${data.msg}`)
            }
        }).catch(function (error) {
            console.error(error);
        }).then(res => {
            resolve();
        });
    })
}

async function answerResults(a, b) {
    // ✅ 修复点：补上加密参数 enckey, enciv
    encts = Date.now().toString();
    const ansdt = AES_Encrypt('{"itemid":' + a + ',"selected":"' + b + '","ts":' + encts + '}', enckey, enciv)
    return new Promise((resolve) => {
        var options = {
            method: 'GET',
            url: `https://apimallwm.exijiu.com/garden/Gardenquestiontask/answerResultsJph?itemid=${a}&selected=${b}&ts=${encts}&encryptData=${ansdt}&version=${encver}`,
            headers: hd(),
        };
        if (debug) {
            log(`\n【debug】=============== 这是  请求 url ===============`);
            log(JSON.stringify(options));
        }
        axios.request(options).then(async function (response) {
            try {
                data = response.data;
                if (debug) {
                    log(`\n\n【debug】===============这是 返回data==============`);
                    log(JSON.stringify(response.data));
                }
                if (data.err == 0) {
                    console.log("答题：" + data.msg)
                } else log(data.msg)
            } catch (e) {
                log(`异常：${data}，原因：${data.msg}`)
            }
        }).catch(function (error) {
            console.error(error);
        }).then(res => {
            resolve();
        });
    })
}

async function dailyShare() {
    encts = Date.now().toString();
    return new Promise((resolve) => {
        var options = {
            method: 'POST',
            url: `https://apimallwm.exijiu.com/garden/gardenmemberinfo/dailyShare`,
            headers: hd(),
            data: {
                "encryptData": AES_Encrypt('{"ts":' + encts + '}', enckey, enciv),
                "ts": encts,
                "version": encver
            }
        };
        if (debug) {
            log(`\n【debug】=============== 这是  请求 url ===============`);
            log(JSON.stringify(options));
        }
        axios.request(options).then(async function (response) {
            try {
                data = response.data;
                if (debug) {
                    log(`\n\n【debug】===============这是 返回data==============`);
                    log(JSON.stringify(response.data));
                }
                if (data.err == 0) {
                    console.log("分享：" + data.data.isTodayFirstShare)
                } else log(data.msg)
            } catch (e) {
                log(`异常：${data}，原因：${data.msg}`)
            }
        }).catch(function (error) {
            console.error(error);
        }).then(res => {
            resolve();
        });
    })
}

async function realscene() {
    return new Promise((resolve) => {
        var options = {
            method: 'GET',
            url: `https://apimallwm.exijiu.com/garden/realscene/reward`,
            headers: hd(),
        };
        if (debug) {
            log(`\n【debug】查看实景请求：${JSON.stringify(options)}`);
        }
        axios.request(options).then(async function (response) {
            try {
                data = response.data;
                if (debug) {
                    log(`\n【debug】查看实景返回：${JSON.stringify(response.data)}`);
                }
                if (data.err == 0) {
                    log("查看实景：" + data.msg);
                } else {
                    log(`查看实景失败：${data.msg}`);
                }
            } catch (e) {
                log(`查看实景处理异常：${e.message}`);
            }
        }).catch(function (error) {
            log(`查看实景请求异常：${error.message}`);
        }).then(res => {
            resolve();
        });
    })
}

// ✅ 修复点：移除未定义变量 a，harvestAll 为全部收获接口
async function harvestAll() {
    encts = Date.now().toString();
    return new Promise((resolve) => {
        var options = {
            method: 'POST',
            url: `https://apimallwm.exijiu.com/garden/Sorghum/harvestAll`,
            headers: hd(),
            data: {
                "encryptData": AES_Encrypt('{"ts":' + encts + '}', enckey, enciv),
                "ts": encts,
                "version": encver
            }
        };
        if (debug) {
            log(`\n【debug】=============== 这是  请求 url ===============`);
            log(JSON.stringify(options));
        }
        axios.request(options).then(async function (response) {
            try {
                data = response.data;
                if (debug) {
                    log(`\n\n【debug】===============这是 返回data==============`);
                    log(JSON.stringify(response.data));
                }
                if (data.err == 0) {
                    console.log("收取：" + data.msg)
                    msg += "\n收取：" + data.msg
                } else log(data.msg)
            } catch (e) {
                log(`异常：${data}，原因：${data.msg}`)
            }
        }).catch(function (error) {
            console.error(error);
        }).then(res => {
            resolve();
        });
    })
}

async function watering(a) {
    encts = Date.now().toString();
    return new Promise((resolve) => {
        var options = {
            method: 'POST',
            url: `https://apimallwm.exijiu.com/garden/sorghum/watering`,
            headers: hd(),
            data: {
                "encryptData": AES_Encrypt('{"id":' + a + ',"ts":' + encts + '}', enckey, enciv),
                "id": a,
                "ts": encts,
                "version": encver
            }
        };
        if (debug) {
            log(`\n【debug】浇水请求参数：${JSON.stringify(options)}`);
        }
        axios.request(options).then(async function (response) {
            try {
                data = response.data;
                if (debug) {
                    log(`\n【debug】浇水返回：${JSON.stringify(response.data)}`);
                }
                if (data.err == 0) {
                    log("浇水：" + data.msg);
                } else {
                    log(`浇水失败：${data.msg}`);
                }
            } catch (e) {
                log(`浇水处理异常：${e.message}`);
            }
        }).catch(function (error) {
            log(`浇水请求异常：${error.message}`);
        }).then(res => {
            resolve();
        });
    })
}

async function makeWineYeast() {
    if (!jwts) {
        log('[!] 缺少网页农场 JWT，跳过制曲');
        return false;
    }
    return new Promise((resolve) => {
        let success = false;
        var options = {
            method: 'POST',
            url: `https://apimallwm.exijiu.com/garden/wheat/makeWineYeast`,
            headers: hd({ "Content-Type": "application/x-www-form-urlencoded" }),
            data: 'volumn=100'
        };
        if (debug) {
            log(`\n【debug】=============== 这是  请求 url ===============`);
            log(JSON.stringify(options));
        }
        axios.request(options).then(async function (response) {
            try {
                data = response.data;
                if (debug) {
                    log(`\n\n【debug】===============这是 返回data==============`);
                    log(JSON.stringify(response.data));
                }
                if (data.err == 0) {
                    success = true
                    console.log("制曲：" + data.msg)
                    msg += "\n制曲：" + data.msg
                } else log(data.msg)
            } catch (e) {
                log(`异常：${data}，原因：${data.msg}`)
            }
        }).catch(function (error) {
            console.error(error);
        }).then(res => {
            resolve(success);
        });
    })
}

async function makeWine() {
    if (!jwts) {
        log('[!] 缺少网页农场 JWT，跳过制酒');
        return false;
    }
    return new Promise((resolve) => {
        let canmake = 200;
        if (sorghum >= 5000 && wine_yeast >= 25) {
            canmake = 5000
        } else if (isPositiveIntegerTimes(getIntegerTimes(sorghum, 200)) == true) {
            canmake = sorghum
        }
        var options = {
            method: 'POST',
            url: `https://apimallwm.exijiu.com/garden/gardenmemberwine/makeWine`,
            headers: hd({ "Content-Type": "application/x-www-form-urlencoded" }),
            data: `volumn=${canmake}`
        };
        if (debug) {
            log(`\n【debug】=============== 这是  请求 url ===============`);
            log(JSON.stringify(options));
        }
        axios.request(options).then(async function (response) {
            try {
                data = response.data;
                if (debug) {
                    log(`\n\n【debug】===============这是 返回data==============`);
                    log(JSON.stringify(response.data));
                }
                if (data.err == 0) {
                    console.log("制酒：" + data.msg)
                    msg += "\n制酒：" + data.msg
                } else log(data.msg)
            } catch (e) {
                log(`异常：${data}，原因：${data.msg}`)
            }
        }).catch(function (error) {
            console.error(error);
        }).then(res => {
            resolve();
        });
    })
}

async function seed(a, b) {
    encts = Date.now().toString();
    return new Promise((resolve) => {
        var options = {
            method: 'POST',
            url: `https://apimallwm.exijiu.com/garden/sorghum/seed`,
            headers: hd(),
            data: {
                "encryptData": AES_Encrypt('{"id":' + a + ',"type":' + b + ',"ts":' + encts + '}', enckey, enciv),
                "id": a,
                "ts": encts,
                "type": b,
                "version": encver
            }
        };
        if (debug) {
            log(`\n【debug】=============== 这是  请求 url ===============`);
            log(JSON.stringify(options));
        }
        axios.request(options).then(async function (response) {
            try {
                data = response.data;
                if (debug) {
                    log(`\n\n【debug】===============这是 返回data==============`);
                    log(JSON.stringify(response.data));
                }
                if (data.err == 0) {
                    console.log("种植：" + data.msg)
                    msg += "\n种植：" + data.msg
                } else log(data.msg)
            } catch (e) {
                log(`异常：${data}，原因：${data.msg}`)
            }
        }).catch(function (error) {
            console.error(error);
        }).then(res => {
            resolve();
        });
    })
}

async function exchange(a) {
    // ✅ 修复点：补上加密参数 enckey, enciv
    encts = Date.now().toString();
    const exc = AES_Encrypt('{"wine":' + a + ',"ts":' + encts + '}', enckey, enciv)
    return new Promise((resolve) => {
        var options = {
            method: 'GET',
            url: `https://apimallwm.exijiu.com/garden/Gardenjifenshop/exchange?wine=` + a + `&ts=${encts}&encryptData=${exc}&version=${encver}`,
            headers: hd(),
        };
        if (debug) {
            log(`\n【debug】=============== 这是  请求 url ===============`);
            log(JSON.stringify(options));
        }
        axios.request(options).then(async function (response) {
            try {
                data = response.data;
                if (debug) {
                    log(`\n\n【debug】===============这是 返回data==============`);
                    log(JSON.stringify(response.data));
                }
                if (data.err == 0) {
                    console.log("积分：" + data.msg)
                    msg += ("\n积分：" + data.msg)
                } else log(data.msg)
            } catch (e) {
                log(`异常：${data}，原因：${data.msg}`)
            }
        }).catch(function (error) {
            console.error(error);
        }).then(res => {
            resolve();
        });
    })
}

async function recommend() {
    return new Promise((resolve) => {
        var options = {
            method: 'GET',
            url: `https://apimallwm.exijiu.com/member/recommend/personal_center?phone_no=17683989907`,
            headers: hd(),
        };
        if (debug) {
            log(`\n【debug】=============== 这是  请求 url ===============`);
            log(JSON.stringify(options));
        }
        axios.request(options).then(async function (response) {
            try {
                data = response.data;
                if (debug) {
                    log(`\n\n【debug】===============这是 返回data==============`);
                    log(JSON.stringify(response.data));
                }
                if (data.err == 0) {
                }
            } catch (e) {
                log(`异常：${data}，原因：${data.msg}`)
            }
        }).catch(function (error) {
            console.error(error);
        }).then(res => {
            resolve();
        });
    })
}

// ✅ 修复点：total 改为 wineTotal，避免覆盖全局地块总数
async function gardenmemberwine() {
    if (!jwts) {
        log('[!] 缺少网页农场 JWT，跳过酒坛查询');
        return false;
    }
    return new Promise((resolve) => {
        let hasActiveWine = false;
        var options = {
            method: 'GET',
            url: `https://apimallwm.exijiu.com/garden/Gardenmemberwine/index`,
            headers: hd(),
        };
        if (debug) {
            log(`\n【debug】=============== 这是  请求 url ===============`);
            log(JSON.stringify(options));
        }
        axios.request(options).then(async function (response) {
            try {
                data = response.data;
                if (debug) {
                    log(`\n\n【debug】===============这是 返回data==============`);
                    log(JSON.stringify(response.data));
                }
                if (data.err == 0) {
                    const wineTotal = data.total
                    if (wineTotal == 1) {
                        hasActiveWine = true
                        volumns = data.data[0].volumn
                        log('酿酒成熟时间：' + data.data[0]['crop_time'])
                        msg += '\n酿酒成熟时间：' + data.data[0]['crop_time']
                        if (data.data[0].status == 4) {
                            await harvestWine(data.data[0].id)
                            hasActiveWine = false
                        }
                    }
                }
            } catch (e) {
                log(`异常：${data}，原因：${data.msg}`)
            }
        }).catch(function (error) {
            console.error(error);
        }).then(res => {
            resolve(hasActiveWine);
        });
    })
}

async function harvestWine(a) {
    return new Promise((resolve) => {
        var options = {
            method: 'GET',
            url: `https://apimallwm.exijiu.com/garden/gardenmemberwine/harvestWine?id=${a}`,
            headers: hd(),
        };
        if (debug) {
            log(`\n【debug】=============== 这是  请求 url ===============`);
            log(JSON.stringify(options));
        }
        axios.request(options).then(async function (response) {
            try {
                data = response.data;
                if (debug) {
                    log(`\n\n【debug】===============这是 返回data==============`);
                    log(JSON.stringify(response.data));
                }
                if (data.err == 0) {
                    log('酿酒收取：' + data.msg)
                    msg += '\n酿酒收取：' + data.msg
                    if (false && cryptoAvailable) {
                        await exchange(volumns)
                    } else {
                        log('[i] 收酒后不自动兑换积分')
                    }
                } else log(data.msg)
            } catch (e) {
                log(`异常：${data}，原因：${data.msg}`)
            }
        }).catch(function (error) {
            console.error(error);
        }).then(res => {
            resolve();
        });
    })
}

// ✅ 修复点：ids 替换为 member_id，修复未定义变量
async function statistics() {
    return new Promise((resolve) => {
        var options = {
            method: 'POST',
            url: `https://apimallwm.exijiu.com/statistics`,
            headers: hd(),
            data: `{"event_id":104,"membaer_id":${member_id},"resolution":""}`
        };
        if (debug) {
            log(`\n【debug】=============== 这是  请求 url ===============`);
            log(JSON.stringify(options));
        }
        axios.request(options).then(async function (response) {
            try {
                data = response.data;
                if (debug) {
                    log(`\n\n【debug】===============这是 返回data==============`);
                    log(JSON.stringify(response.data));
                }
                if (data.err == 0) {
                    log(data.msg)
                } else log(data.msg)
            } catch (e) {
                log(`异常：${data}，原因：${data.msg}`)
            }
        }).catch(function (error) {
            console.error(error);
        }).then(res => {
            resolve();
        });
    })
}

async function statistics1(aa) {
    return new Promise((resolve) => {
        var options = {
            method: 'POST',
            url: `https://apimallwm.exijiu.com/statistics`,
            headers: hd(),
            data: `{"event_id":${aa},"membaer_id":${member_id},"os":"Android 10","brower":"chrome","phone_model":"PCAM00","networktype":"wifi","resolution":""}`
        };
        if (debug) {
            log(`\n【debug】=============== 这是  请求 url ===============`);
            log(JSON.stringify(options));
        }
        axios.request(options).then(async function (response) {
            try {
                data = response.data;
                if (debug) {
                    log(`\n\n【debug】===============这是 返回data==============`);
                    log(JSON.stringify(response.data));
                }
                if (data.err == 0) {
                    log(data.msg)
                } else log(data.msg)
            } catch (e) {
                log(`异常：${data}，原因：${data.msg}`)
            }
        }).catch(function (error) {
            console.error(error);
        }).then(res => {
            resolve();
        });
    })
}

async function Gardenmemberwine() {
    return new Promise((resolve) => {
        var options = {
            method: 'GET',
            url: `https://apimallwm.exijiu.com/garden/Gardenmemberwine/index`,
            headers: hd(),
        };
        if (debug) {
            log(`\n【debug】=============== 这是  请求 url ===============`);
            log(JSON.stringify(options));
        }
        axios.request(options).then(async function (response) {
            try {
                data = response.data;
                if (debug) {
                    log(`\n\n【debug】===============这是 返回data==============`);
                    log(JSON.stringify(response.data));
                }
                if (data.err == 0) {
                    log(data.msg)
                } else log(data.msg)
            } catch (e) {
                log(`异常：${data}，原因：${data.msg}`)
            }
        }).catch(function (error) {
            console.error(error);
        }).then(res => {
            resolve();
        });
    })
}

function AES_Encrypt(word, keys, ivs) {
    var key = CryptoJS.enc.Utf8.parse(keys);
    var iv = CryptoJS.enc.Utf8.parse(ivs);
    var srcs = CryptoJS.enc.Utf8.parse(word);
    var encrypted = CryptoJS.AES.encrypt(srcs, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });
    return CryptoJS.enc.Hex.stringify(CryptoJS.enc.Base64.parse(encrypted.toString()));
}

function AES_Decrypt(word, keys, ivs) {
    var key = CryptoJS.enc.Utf8.parse(keys);
    var iv = CryptoJS.enc.Utf8.parse(ivs);
    var srcs = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Hex.parse(word));
    var decrypt = CryptoJS.AES.decrypt(srcs, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });
    return decrypt.toString(CryptoJS.enc.Utf8);
}

function getIntegerTimes(arg1, arg2) {
    if (arg1 < arg2) {
        var flag = arg1;
        arg1 = arg2;
        arg2 = arg1;
    }
    let t1 = 0,
        t2 = 0,
        r1,
        r2;
    try {
        t1 = arg1.toString().split(".")[1].length
    } catch (e) { }
    try {
        t2 = arg2.toString().split(".")[1].length
    } catch (e) { }
    r1 = Number(arg1.toString().replace(".", ""));
    r2 = Number(arg2.toString().replace(".", ""));
    return (r1 / r2) * Math.pow(10, t2 - t1);
}
function isPositiveIntegerTimes(arg) {
    var num = arg.toString();
    if (!(/(^[1-9]\d*$)/.test(num))) {
        return false;
    } else {
        return true;
    }
}

/**
 * 用小程序 Token 换取网页农场接口使用的 JWT。
 */
async function getGardenJwt() {
    if (gardenToken) {
        jwts = gardenToken;
        log("[+] 使用 YYB garden JWT");
        return true;
    }
    try {
        const response = await axios.request({
            method: 'GET',
            url: 'https://xcx.exijiu.com/anti-channeling/public/index.php/api/v2/Member/getJwt',
            headers: hd(),
            timeout: 10000
        });
        const result = response.data;
        if (result && result.data && result.data.jwt) {
            jwts = result.data.jwt;
            log('[+] 网页农场 JWT 获取成功');
            return true;
        }
        log(`[!] 网页农场 JWT 返回异常：${result && (result.message || result.msg || result.code)}`);
    } catch (error) {
        log(`[!] 获取网页农场 JWT 失败：${error.message}`);
    }
    jwts = '';
    return false;
}

async function getTokenFromApi() {
    return new Promise((resolve) => {
        const options = {
            method: 'GET',
            url: 'http://127.0.0.1:8890/api/token',
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000
        };
        axios.request(options)
            .then((response) => {
                const res = response.data;
                if (res.code === 0 && res.data && res.data.token) {
                    log(`[+] 已从接口自动获取最新 Token: ${res.data.token.substring(0, 20)}...`);
                    resolve(res.data.token);
                } else {
                    log(`[-] 接口返回异常: ${JSON.stringify(res)}`);
                    resolve(null);
                }
            })
            .catch((err) => {
                log(`[-] 获取 Token 失败: ${err.message}`);
                resolve(null);
            });
    });
}

async function Envs() {
    const refs = ($.isNode() ? process.env.YYB_REF : "") || "";
    if (refs) {
        String(refs).split(/[@&\n]+/).forEach((item) => {
            const t = String(item).trim();
            if (t) xjhdArr.push(t);
        });
        log(`[i] 使用 YYB_REF，共 ${xjhdArr.length} 个账号，YYB_SERVER=${YYB_SERVER}`);
        return true;
    }
    if (xjhd) {
        if (xjhd.indexOf("@") != -1) {
            xjhd.split("@").forEach((item) => {
                xjhdArr.push(item);
            });
        } else if (xjhd.indexOf("\n") != -1) {
            xjhd.split("\n").forEach((item) => {
                xjhdArr.push(item);
            });
        } else {
            xjhdArr.push(xjhd);
        }
    } else {
        log(`[!] 未配置 YYB_REF / xjhd，默认 YYB ref=1`);
        xjhdArr = ["1"];
    }
    return true;
}

function addNotifyStr(str, is_log = true) {
    if (is_log) {
        log(`${str}\n`)
    }
    msg += `${str}\n`
}

function conversionTimestamp(timestamp) {
    let date = new Date(timestamp * 1000)
    let Year = date.getFullYear() + '-'
    let Month = (date.getMonth() < 9 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1) + '-';
    function format(time) {
        return time < 10 ? '0' + time : time;
    }
    let D = format(date.getDate()) + ' ';
    let h = format(date.getHours()) + ':';
    let m = format(date.getMinutes()) + ':';;
    let s = format(date.getSeconds());
    return Year + Month + D + h + m + s;
}

async function SendMsg(message) {
    if (!message)
        return;
    if (Notify > 0) {
        if ($.isNode()) {
            var notify = require('./sendNotify');
            await notify.sendNotify($.name, message);
        } else {
            $.msg(message);
        }
    } else {
        log(message);
    }
}

function Env(t, e) {
    "undefined" != typeof process && JSON.stringify(process.env).indexOf("GITHUB") > -1 && process.exit(0);
    class s {
        constructor(t) {
            this.env = t
        }
        send(t, e = "GET") {
            t = "string" == typeof t ? {
                url: t
            } : t;
            let s = this.get;
            return "POST" === e && (s = this.post), new Promise((e, i) => {
                s.call(this, t, (t, s, r) => {
                    t ? i(t) : e(s)
                })
            })
        }
        get(t) {
            return this.send.call(this.env, t)
        }
        post(t) {
            return this.send.call(this.env, t, "POST")
        }
    }
    return new class {
        constructor(t, e) {
            this.name = t, this.http = new s(this), this.data = null, this.dataFile = "box.dat", this.logs = [], this.isMute = !1, this.isNeedRewrite = !1, this.logSeparator = "\n", this.startTime = (new Date).getTime(), Object.assign(this, e), this.log("", `🔔${this.name}, 开始!`)
        }
        isNode() {
            return "undefined" != typeof module && !!module.exports
        }
        isQuanX() {
            return "undefined" != typeof $task
        }
        isSurge() {
            return "undefined" != typeof $httpClient && "undefined" == typeof $loon
        }
        isLoon() {
            return "undefined" != typeof $loon
        }
        toObj(t, e = null) {
            try {
                return JSON.parse(t)
            } catch {
                return e
            }
        }
        toStr(t, e = null) {
            try {
                return JSON.stringify(t)
            } catch {
                return e
            }
        }
        getjson(t, e) {
            let s = e;
            const i = this.getdata(t);
            if (i) try {
                s = JSON.parse(this.getdata(t))
            } catch { }
            return s
        }
        setjson(t, e) {
            try {
                return this.setdata(JSON.stringify(t), e)
            } catch {
                return !1
            }
        }
        getScript(t) {
            return new Promise(e => {
                this.get({
                    url: t
                }, (t, s, i) => e(i))
            })
        }
        runScript(t, e) {
            return new Promise(s => {
                let i = this.getdata("@chavy_boxjs_userCfgs.httpapi");
                i = i ? i.replace(/\n/g, "").trim() : i;
                let r = this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");
                r = r ? 1 * r : 20, r = e && e.timeout ? e.timeout : r;
                const [o, h] = i.split("@"), n = {
                    url: `http://${h}/v1/scripting/evaluate`,
                    body: {
                        script_text: t,
                        mock_type: "cron",
                        timeout: r
                    },
                    headers: {
                        "X-Key": o,
                        Accept: "*/*"
                    }
                };
                this.post(n, (t, e, i) => s(i))
            }).catch(t => this.logErr(t))
        }
        loaddata() {
            if (!this.isNode()) return {}; {
                this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path");
                const t = this.path.resolve(this.dataFile),
                    e = this.path.resolve(process.cwd(), this.dataFile),
                    s = this.fs.existsSync(t),
                    i = !s && this.fs.existsSync(e);
                if (!s && !i) return {}; {
                    const i = s ? t : e;
                    try {
                        return JSON.parse(this.fs.readFileSync(i))
                    } catch (t) {
                        return {}
                    }
                }
            }
        }
        writedata() {
            if (this.isNode()) {
                this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path");
                const t = this.path.resolve(this.dataFile),
                    e = this.path.resolve(process.cwd(), this.dataFile),
                    s = this.fs.existsSync(t),
                    i = !s && this.fs.existsSync(e),
                    r = JSON.stringify(this.data);
                s ? this.fs.writeFileSync(t, r) : i ? this.fs.writeFileSync(e, r) : this.fs.writeFileSync(t, r)
            }
        }
        lodash_get(t, e, s) {
            const i = e.replace(/\[(\d+)\]/g, ".$1").split(".");
            let r = t;
            for (const t of i)
                if (r = Object(r)[t], void 0 === r) return s;
            return r
        }
        lodash_set(t, e, s) {
            return Object(t) !== t ? t : (Array.isArray(e) || (e = e.toString().match(/[^.[\]]+/g) || []), e.slice(0, -1).reduce((t, s, i) => Object(t[s]) === t[s] ? t[s] : t[s] = Math.abs(e[i + 1]) >> 0 == +e[i + 1] ? [] : {}, t)[e[e.length - 1]] = s, t)
        }
        getdata(t) {
            let e = this.getval(t);
            if (/^@/.test(t)) {
                const [, s, i] = /^@(.*?)\.(.*?)$/.exec(t), r = s ? this.getval(s) : "";
                if (r) try {
                    const t = JSON.parse(r);
                    e = t ? this.lodash_get(t, i, "") : e
                } catch (t) {
                    e = ""
                }
            }
            return e
        }
        setdata(t, e) {
            let s = !1;
            if (/^@/.test(e)) {
                const [, i, r] = /^@(.*?)\.(.*?)$/.exec(e), o = this.getval(i),
                    h = i ? "null" === o ? null : o || "{}" : "{}";
                try {
                    const e = JSON.parse(h);
                    this.lodash_set(e, r, t), s = this.setval(JSON.stringify(e), i)
                } catch (e) {
                    const o = {};
                    this.lodash_set(o, r, t), s = this.setval(JSON.stringify(o), i)
                }
            } else s = this.setval(t, e);
            return s
        }
        getval(t) {
            return this.isSurge() || this.isLoon() ? $persistentStore.read(t) : this.isQuanX() ? $prefs.valueForKey(t) : this.isNode() ? (this.data = this.loaddata(), this.data[t]) : this.data && this.data[t] || null
        }
        setval(t, e) {
            return this.isSurge() || this.isLoon() ? $persistentStore.write(t, e) : this.isQuanX() ? $prefs.setValueForKey(t, e) : this.isNode() ? (this.data = this.loaddata(), this.data[e] = t, this.writedata(), !0) : this.data && this.data[e] || null
        }
        initGotEnv(t) {
            this.got = this.got ? this.got : require("got"), this.cktough = this.cktough ? this.cktough : require("tough-cookie"), this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar, t && (t.headers = t.headers ? t.headers : {}, void 0 === t.headers.Cookie && void 0 === t.cookieJar && (t.cookieJar = this.ckjar))
        }
        get(t, e = (() => { })) {
            t.headers && (delete t.headers["Content-Type"], delete t.headers["Content-Length"]), this.isSurge() || this.isLoon() ? (this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, {
                "X-Surge-Skip-Scripting": !1
            })), $httpClient.get(t, (t, s, i) => {
                !t && s && (s.body = i, s.statusCode = s.status), e(t, s, i)
            })) : this.isQuanX() ? (this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, {
                hints: !1
            })), $task.fetch(t).then(t => {
                const {
                    statusCode: s,
                    statusCode: i,
                    headers: r,
                    body: o
                } = t;
                e(null, {
                    status: s,
                    statusCode: i,
                    headers: r,
                    body: o
                }, o)
            }, t => e(t))) : this.isNode() && (this.initGotEnv(t), this.got(t).on("redirect", (t, e) => {
                try {
                    if (t.headers["set-cookie"]) {
                        const s = t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();
                        s && this.ckjar.setCookieSync(s, null), e.cookieJar = this.ckjar
                    }
                } catch (t) {
                    this.logErr(t)
                }
            }).then(t => {
                const {
                    statusCode: s,
                    statusCode: i,
                    headers: r,
                    body: o
                } = t;
                e(null, {
                    status: s,
                    statusCode: i,
                    headers: r,
                    body: o
                }, o)
            }, t => {
                const {
                    message: s,
                    response: i
                } = t;
                e(s, i, i && i.body)
            }))
        }
        post(t, e = (() => { })) {
            if (t.body && t.headers && !t.headers["Content-Type"] && (t.headers["Content-Type"] = "application/x-www-form-urlencoded"), t.headers && delete t.headers["Content-Length"], this.isSurge() || this.isLoon()) this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, {
                "X-Surge-Skip-Scripting": !1
            })), $httpClient.post(t, (t, s, i) => {
                !t && s && (s.body = i, s.statusCode = s.status), e(t, s, i)
            });
            else if (this.isQuanX()) t.method = "POST", this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, {
                hints: !1
            })), $task.fetch(t).then(t => {
                const {
                    statusCode: s,
                    statusCode: i,
                    headers: r,
                    body: o
                } = t;
                e(null, {
                    status: s,
                    statusCode: i,
                    headers: r,
                    body: o
                }, o)
            }, t => e(t));
            else if (this.isNode()) {
                this.initGotEnv(t);
                const {
                    url: s,
                    ...i
                } = t;
                this.got.post(s, i).then(t => {
                    const {
                        statusCode: s,
                        statusCode: i,
                        headers: r,
                        body: o
                    } = t;
                    e(null, {
                        status: s,
                        statusCode: i,
                        headers: r,
                        body: o
                    }, o)
                }, t => {
                    const {
                        message: s,
                        response: i
                    } = t;
                    e(s, i, i && i.body)
                })
            }
        }
        time(t, e = null) {
            const s = e ? new Date(e) : new Date;
            let i = {
                "M+": s.getMonth() + 1,
                "d+": s.getDate(),
                "H+": s.getHours(),
                "m+": s.getMinutes(),
                "s+": s.getSeconds(),
                "q+": Math.floor((s.getMonth() + 3) / 3),
                S: s.getMilliseconds()
            };
            /(y+)/.test(t) && (t = t.replace(RegExp.$1, (s.getFullYear() + "").substr(4 - RegExp.$1.length)));
            for (let e in i) new RegExp("(" + e + ")").test(t) && (t = t.replace(RegExp.$1, 1 == RegExp.$1.length ? i[e] : ("00" + i[e]).substr(("" + i[e]).length)));
            return t
        }
        msg(e = t, s = "", i = "", r) {
            const o = t => {
                if (!t) return t;
                if ("string" == typeof t) return this.isLoon() ? t : this.isQuanX() ? {
                    "open-url": t
                } : this.isSurge() ? {
                    url: t
                } : void 0;
                if ("object" == typeof t) {
                    if (this.isLoon()) {
                        let e = t.openUrl || t.url || t["open-url"],
                            s = t.mediaUrl || t["media-url"];
                        return {
                            openUrl: e,
                            mediaUrl: s
                        }
                    }
                    if (this.isQuanX()) {
                        let e = t["open-url"] || t.url || t.openUrl,
                            s = t["media-url"] || t.mediaUrl;
                        return {
                            "open-url": e,
                            "media-url": s
                        }
                    }
                    if (this.isSurge()) {
                        let e = t.url || t.openUrl || t["open-url"];
                        return {
                            url: e
                        }
                    }
                }
            };
            if (this.isMute || (this.isSurge() || this.isLoon() ? $notification.post(e, s, i, o(r)) : this.isQuanX() && $notify(e, s, i, o(r))), !this.isMuteLog) {
                let t = ["", "==============📣系统通知📣=============="];
                t.push(e), s && t.push(s), i && t.push(i), console.log(t.join("\n")), this.logs = this.logs.concat(t)
            }
        }
        log(...t) {
            t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(t.join(this.logSeparator))
        }
        logErr(t, e) {
            const s = !this.isSurge() && !this.isQuanX() && !this.isLoon();
            s ? this.log("", `❗️${this.name}, 错误!`, t.stack) : this.log("", `❗️${this.name}, 错误!`, t)
        }
        wait(t) {
            return new Promise(e => setTimeout(e, t))
        }
        done(t = {}) {
            const e = (new Date).getTime(),
                s = (e - this.startTime) / 1e3;
            this.log("", `🔔${this.name}, 结束! 🕛 ${s} 秒`), this.log(), (this.isSurge() || this.isQuanX() || this.isLoon()) && $done(t)
        }
    }(t, e)
}
