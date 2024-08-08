(function () {
    const originalFetch = unsafeWindow.fetch
    const originalNodeAppendChild = unsafeWindow.Node.prototype.appendChild
    const originalAddEventListener = unsafeWindow.EventTarget.prototype.addEventListener

    const isNull = (obj: any): obj is null => typeof obj === 'undefined' || obj === null
    const isObject = (obj: any): obj is Object => !isNull(obj) && typeof obj === 'object' && !Array.isArray(obj)
    const isString = (obj: any): obj is String => !isNull(obj) && typeof obj === 'string'
    const isNumber = (obj: any): obj is Number => !isNull(obj) && typeof obj === 'number'
    const isElement = (obj: any): obj is Element => !isNull(obj) && obj instanceof Element
    const isNode = (obj: any): obj is Node => !isNull(obj) && obj instanceof Node
    const isStringTupleArray = (obj: any): obj is [string, string][] => Array.isArray(obj) && obj.every(item => Array.isArray(item) && item.length === 2 && typeof item[0] === 'string' && typeof item[1] === 'string')
    const hasFunction = (obj: any, method: string): boolean => {
        return !method.isEmpty() && !isNull(obj) ? method in obj && typeof obj[method] === 'function' : false
    }
    const getString = (obj: any): string => {
        obj = obj instanceof Error ? String(obj) : obj
        obj = obj instanceof Date ? obj.format('YYYY-MM-DD') : obj
        return typeof obj === 'object' ? JSON.stringify(obj, null, 2) : String(obj)
    }
    Array.prototype.any = function () {
        return this.prune().length > 0
    }
    Array.prototype.prune = function () {
        return this.filter(i => i !== null && typeof i !== 'undefined')
    }
    Array.prototype.unique = function <T>(this: T[], prop?: keyof T): T[] {
        return this.filter((item, index, self) =>
            index === self.findIndex((t) => (
                prop ? t[prop] === item[prop] : t === item
            ))
        )
    }
    Array.prototype.union = function <T>(this: T[], that: T[], prop?: keyof T): T[] {
        return [...this, ...that].unique(prop)
    }
    Array.prototype.intersect = function <T>(this: T[], that: T[], prop?: keyof T): T[] {
        return this.filter((item) =>
            that.some((t) => prop ? t[prop] === item[prop] : t === item)
        ).unique(prop)
    }
    Array.prototype.difference = function <T>(this: T[], that: T[], prop?: keyof T): T[] {
        return this.filter((item) =>
            !that.some((t) => prop ? t[prop] === item[prop] : t === item)
        ).unique(prop)
    }
    Array.prototype.complement = function <T>(this: T[], that: T[], prop?: keyof T): T[] {
        return this.union(that, prop).difference(this.intersect(that, prop), prop)
    }
    String.prototype.isEmpty = function () {
        return !isNull(this) && this.length === 0
    }
    String.prototype.among = function (start: string, end: string, greedy: boolean = false) {
        if (this.isEmpty() || start.isEmpty() || end.isEmpty()) return ''
        if (!greedy && start === end) return ''
        const startIndex = greedy ? this.indexOf(start) : this.lastIndexOf(start)
        if (startIndex === -1) return ''
        const endIndex = greedy ? this.lastIndexOf(end) : this.indexOf(end, startIndex + start.length)
        return (endIndex === -1 || endIndex < startIndex + start.length) ? '' : this.substring(startIndex + start.length, endIndex)
    }
    String.prototype.splitLimit = function (separator: string, limit?: number) {
        if (this.isEmpty() || isNull(separator)) {
            throw new Error('Empty')
        }
        let body = this.split(separator)
        return limit ? body.slice(0, limit).concat(body.slice(limit).join(separator)) : body
    }
    String.prototype.truncate = function (maxLength) {
        return this.length > maxLength ? this.substring(0, maxLength) : this.toString()
    }
    String.prototype.trimHead = function (prefix: string) {
        return this.startsWith(prefix) ? this.slice(prefix.length) : this.toString()
    }
    String.prototype.trimTail = function (suffix: string) {
        return this.endsWith(suffix) ? this.slice(0, -suffix.length) : this.toString()
    }

    String.prototype.toURL = function () {
        let URLString = this
        if (URLString.split('//')[0].isEmpty()) {
            URLString = `${unsafeWindow.location.protocol}${URLString}`
        }
        return new URL(URLString.toString())
    }

    Array.prototype.append = function (arr) {
        this.push(...arr)
    }

    String.prototype.replaceVariable = function (replacements, count = 0) {
        let replaceString = this.toString()
        try {
            replaceString = Object.entries(replacements).reduce((str, [key, value]) => {
                if (str.includes(`%#${key}:`)) {
                    let format = str.among(`%#${key}:`, '#%').toString()
                    return str.replaceAll(`%#${key}:${format}#%`, getString(hasFunction(value, 'format') ? value.format(format) : value))
                } else {
                    return str.replaceAll(`%#${key}#%`, getString(value))
                }
            },
                replaceString
            )
            count++
            return Object.keys(replacements).map((key) => this.includes(`%#${key}#%`)).includes(true) && count < 128 ? replaceString.replaceVariable(replacements, count) : replaceString
        } catch (error) {
            GM_getValue('isDebug') && console.log(`replace variable error: ${getString(error)}`)
            return replaceString
        }
    }
    function prune(obj: any): any {
        if (Array.isArray(obj)) {
            return obj.filter(isNotEmpty).map(prune);
        }
        if (isElement(obj) || isNode(obj)) {
            return obj
        }
        if (isObject(obj)) {
            return Object.fromEntries(
                Object.entries(obj)
                    .filter(([key, value]) => isNotEmpty(value))
                    .map(([key, value]) => [key, prune(value)])
            )
        }
        return isNotEmpty(obj) ? obj : undefined;
    }
    function isNotEmpty(obj: any): boolean {
        if (isNull(obj)) {
            return false
        }
        if (Array.isArray(obj)) {
            return obj.some(isNotEmpty);
        }
        if (isString(obj)) {
            return !obj.isEmpty();
        }
        if (isNumber(obj)) {
            return !Number.isNaN(obj)
        }
        if (isElement(obj) || isNode(obj)) {
            return true
        }
        if (isObject(obj)) {
            return Object.values(obj).some(isNotEmpty)
        }
        return true
    }

    const fetch = (input: RequestInfo, init?: RequestInit, force?: boolean): Promise<Response> => {
        if (init && init.headers && isStringTupleArray(init.headers)) throw new Error("init headers Error")
        if (init && init.method && !(init.method === 'GET' || init.method === 'HEAD' || init.method === 'POST')) throw new Error("init method Error")
        return force || (typeof input === 'string' ? input : input.url).toURL().hostname !== unsafeWindow.location.hostname ? new Promise((resolve, reject) => {
            GM_xmlhttpRequest(prune({
                method: (init && init.method) as "GET" | "HEAD" | "POST" || 'GET',
                url: typeof input === 'string' ? input : input.url,
                headers: (init && init.headers) as Tampermonkey.RequestHeaders || {},
                data: ((init && init.body) || null) as string,
                onload: function (response: Tampermonkey.ResponseBase) {
                    resolve(new Response(response.responseText, {
                        status: response.status,
                        statusText: response.statusText,
                    }))
                },
                onerror: function (error: Error) {
                    reject(error)
                }
            }))
        }) : originalFetch(input, init)
    }
    const UUID = function () {
        return Array.from({ length: 8 }, () => (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1)).join('')
    }
    const ceilDiv = function (dividend: number, divisor: number): number {
        return Math.floor(dividend / divisor) + (dividend % divisor > 0 ? 1 : 0)
    }



    const language = function () {
        let env = (!isNull(config) ? config.language : (navigator.language ?? navigator.languages[0] ?? 'en')).replace('-', '_')
        let main = env.split('_').shift() ?? 'en'
        return (!isNull(i18n[env]) ? env : !isNull(i18n[main]) ? main : 'en')
    }

    const renderNode = function (renderCode: RenderCode): Node | Element {
        renderCode = prune(renderCode)
        if (isNull(renderCode)) throw new Error("RenderCode null")
        if (typeof renderCode === 'string') {
            return document.createTextNode(renderCode.replaceVariable(i18n[language()]).toString())
        }
        if (renderCode instanceof Node) {
            return renderCode
        }
        if (typeof renderCode !== 'object' || !renderCode.nodeType) {
            throw new Error('Invalid arguments')
        }
        const { nodeType, attributes, events, className, childs } = renderCode
        const node: Element = document.createElement(nodeType);
        (!isNull(attributes) && Object.keys(attributes).any()) && Object.entries(attributes).forEach(([key, value]: [string, string]) => node.setAttribute(key, value));
        (!isNull(events) && Object.keys(events).any()) && Object.entries(events).forEach(([eventName, eventHandler]: [string, EventListenerOrEventListenerObject]) => originalAddEventListener.call(node, eventName, eventHandler));
        (!isNull(className) && className.length > 0) && node.classList.add(...[].concat(className))
        !isNull(childs) && node.append(...[].concat(childs).map(renderNode))
        return node
    }
    const findElement = function (element: Element, condition: string) {
        while (element && !element.matches(condition)) {
            element = element.parentElement
        }
        return element
    }
    enum ToastType {
        Log,
        Info,
        Warn,
        Error
    }
    enum VersionState {
        Low,
        Equal,
        High
    }
    class Version implements IVersion {
        major: number;
        minor: number;
        patch: number;
        preRelease: string[];
        buildMetadata: string;

        constructor(versionString: string) {
            const [version, preRelease, buildMetadata] = versionString.split(/[-+]/);
            const versionParts = version.split('.').map(Number);
            this.major = versionParts[0] || 0;
            this.minor = versionParts.length > 1 ? versionParts[1] : 0;
            this.patch = versionParts.length > 2 ? versionParts[2] : 0;
            this.preRelease = preRelease ? preRelease.split('.') : [];
            this.buildMetadata = buildMetadata;
        }

        public compare(other: IVersion): VersionState {
            const compareSegment = (a: number | string, b: number | string): VersionState => {
                if (a < b) {
                    return VersionState.Low;
                } else if (a > b) {
                    return VersionState.High;
                }
                return VersionState.Equal;
            };

            let state = compareSegment(this.major, other.major);
            if (state !== VersionState.Equal) return state;

            state = compareSegment(this.minor, other.minor);
            if (state !== VersionState.Equal) return state;

            state = compareSegment(this.patch, other.patch);
            if (state !== VersionState.Equal) return state;

            for (let i = 0; i < Math.max(this.preRelease.length, other.preRelease.length); i++) {
                const pre1 = this.preRelease[i];
                const pre2 = other.preRelease[i];
                if (pre1 === undefined && pre2 !== undefined) {
                    return VersionState.High;
                } else if (pre1 !== undefined && pre2 === undefined) {
                    return VersionState.Low;
                }
                if (pre1 !== undefined && pre2 !== undefined) {
                    state = compareSegment(isNaN(+pre1) ? pre1 : +pre1, isNaN(+pre2) ? pre2 : +pre2);
                    if (state !== VersionState.Equal) return state;
                }
            }

            return VersionState.Equal;
        }
    }



    if (GM_getValue('isDebug')) {
        console.log(getString(GM_info))
        debugger
    }

    enum DownloadType {
        Aria2,
        Browser,
        Others
    }

    class I18N {
        [key: string]: { [key: string]: RenderCode | RenderCode[] }
        public zh_CN = this['zh']
        public zh: { [key: string]: RenderCode | RenderCode[] } = {
            appName: 'IwaraZip 增强',
            language: '语言: ',
            downloadPath: '下载到: ',
            downloadProxy: '下载代理: ',
            aria2Path: 'Aria2 RPC: ',
            aria2Token: 'Aria2 密钥: ',
            rename: '重命名',
            save: '保存',
            reset: '重置',
            ok: '确定',
            on: '开启',
            off: '关闭',
            isDebug: '调试模式',
            downloadType: '下载方式',
            browserDownload: '浏览器下载',
            configurationIncompatible: '检测到不兼容的配置文件，请重新配置！',
            browserDownloadNotEnabled: `未启用下载功能！`,
            browserDownloadNotWhitelisted: `请求的文件扩展名未列入白名单！`,
            browserDownloadNotPermitted: `下载功能已启用，但未授予下载权限！`,
            browserDownloadNotSupported: `目前浏览器/版本不支持下载功能！`,
            browserDownloadNotSucceeded: `下载未开始或失败！`,
            browserDownloadUnknownError: `未知错误，有可能是下载时提供的参数存在问题，请检查文件名是否合法！`,
            browserDownloadTimeout: `下载超时，请检查网络环境是否正常！`,
            loadingCompleted: '加载完成',
            settings: '打开设置',
            configError: '脚本配置中存在错误，请修改。',
            alreadyKnowHowToUse: '我已知晓如何使用!!!',
            notice: [
                { nodeType: 'br' },
                '测试版本，发现问题请前往GitHub反馈！'
            ],
            pushTaskSucceed: '推送下载任务成功！',
            connectionTest: '连接测试',
            settingsCheck: '配置检查',
            createTask: '创建任务',
            downloadPathError: '下载路径错误!',
            browserDownloadModeError: '请启用脚本管理器的浏览器API下载模式!',
            parsingProgress: '解析进度: ',
            downloadFailed: '下载失败！',
            pushTaskFailed: '推送下载任务失败！'
        }
    }

    class Config {
        configChange: Function
        language: string
        downloadType: DownloadType
        downloadPath: string
        downloadProxy: string
        aria2Path: string
        aria2Token: string
        [key: string]: any
        constructor() {
            this.language = language()
            this.downloadType = DownloadType.Others
            this.downloadPath = '/IwaraZip/%#NowTime:YYYY-MM-DD#%/%#FileName#%'
            this.downloadProxy = ''
            this.aria2Path = 'http://127.0.0.1:6800/jsonrpc'
            this.aria2Token = ''
            let body = new Proxy(this, {
                get: function (target, property: string) {
                    if (property === 'configChange') {
                        return target.configChange
                    }
                    let value = GM_getValue(property, target[property])
                    GM_getValue('isDebug') && console.log(`get: ${property} ${getString(value)}`)
                    return value
                },
                set: function (target, property: string, value) {
                    if (property === 'configChange') {
                        target.configChange = value
                        return true
                    }
                    GM_setValue(property, value)
                    GM_getValue('isDebug') && console.log(`set: ${property} ${getString(value)}`)
                    target.configChange(property)
                    return true
                }
            })
            GM_listValues().forEach((value) => {
                GM_addValueChangeListener(value, (name: string, old_value: any, new_value: any, remote: boolean) => {
                    GM_getValue('isDebug') && console.log(`$Is Remote: ${remote} Change Value: ${name}`)//old: ${getString(old_value)} new: ${getString(new_value)}
                    if (remote && !isNull(body.configChange)) body.configChange(name)
                })
            })
            return body
        }
        public async check() {
            switch (this.downloadType) {
                case DownloadType.Aria2:
                    return await aria2Check()
                case DownloadType.Browser:
                    return await EnvCheck()
                default:
                    break
            }
            return true
        }
    }

    class configEdit {
        source: configEdit
        target: Config
        interface: HTMLElement
        interfacePage: HTMLElement
        constructor(config: Config) {
            this.target = config
            this.target.configChange = (item: string) => { this.configChange.call(this, item) }
            this.interfacePage = renderNode({
                nodeType: 'p'
            }) as HTMLElement
            let save = renderNode({
                nodeType: 'button',
                childs: '%#save#%',
                attributes: {
                    title: i18n[language()].save
                },
                events: {
                    click: async () => {
                        save.disabled = !save.disabled
                        if (await this.target.check()) {
                            unsafeWindow.location.reload()
                        }
                        save.disabled = !save.disabled
                    }
                }
            }) as HTMLButtonElement
            let reset = renderNode({
                nodeType: 'button',
                childs: '%#reset#%',
                attributes: {
                    title: i18n[language()].reset
                },
                events: {
                    click: () => {
                        firstRun()
                        unsafeWindow.location.reload()
                    }
                }
            }) as HTMLButtonElement
            this.interface = renderNode({
                nodeType: 'div',
                attributes: {
                    id: 'pluginConfig'
                },
                childs: [
                    {
                        nodeType: 'div',
                        className: 'main',
                        childs: [
                            {
                                nodeType: 'h2',
                                childs: '%#appName#%'
                            },
                            {
                                nodeType: 'label',
                                childs: [
                                    '%#language#% ',
                                    {
                                        nodeType: 'input',
                                        className: 'inputRadioLine',
                                        attributes: Object.assign(
                                            {
                                                name: 'language',
                                                type: 'text',
                                                value: this.target.language
                                            }
                                        ),
                                        events: {
                                            change: (event: Event) => {
                                                this.target.language = (event.target as HTMLInputElement).value
                                            }
                                        }
                                    }
                                ]
                            },
                            this.downloadTypeSelect(),
                            this.interfacePage,
                            this.switchButton('isDebug', GM_getValue, (name: string, e) => { GM_setValue(name, (e.target as HTMLInputElement).checked) }, false),
                        ]
                    },
                    {
                        nodeType: 'p',
                        className: 'buttonList',
                        childs: [
                            reset,
                            save
                        ]
                    }
                ]
            }) as HTMLElement

        }
        private switchButton(name: string, get?: (name: string, defaultValue?: any) => any, set?: (name: string, e: Event) => void, defaultValue?: boolean): RenderCode {
            let button = renderNode({
                nodeType: 'p',
                className: 'inputRadioLine',
                childs: [
                    {
                        nodeType: 'label',
                        childs: `%#${name}#%`,
                        attributes: {
                            for: name
                        }
                    }, {
                        nodeType: 'input',
                        className: 'switch',
                        attributes: {
                            type: 'checkbox',
                            name: name,
                        },
                        events: {
                            change: (e: Event) => {
                                if (set !== undefined) {
                                    set(name, e)
                                    return
                                } else {
                                    this.target[name] = (e.target as HTMLInputElement).checked
                                }
                            }
                        }
                    }
                ]
            }) as HTMLElement
            (button.querySelector(`[name='${name}']`) as HTMLInputElement).checked = get !== undefined ? get(name, defaultValue) : this.target[name] ?? defaultValue ?? false
            return button
        }
        private inputComponent(name: string, type?: string, get?: (name: string) => void, set?: (name: string, e: Event) => void): RenderCode {
            return {
                nodeType: 'label',
                childs: [
                    `%#${name}#% `,
                    {
                        nodeType: 'input',
                        attributes: Object.assign(
                            {
                                name: name,
                                type: type ?? 'text',
                                value: get !== undefined ? get(name) : this.target[name]
                            }
                        ),
                        events: {
                            change: (e: Event) => {
                                if (set !== undefined) {
                                    set(name, e)
                                    return
                                } else {
                                    this.target[name] = (e.target as HTMLInputElement).value
                                }
                            }
                        }
                    }
                ]
            }
        }
        private downloadTypeSelect(): RenderCode {
            let select = renderNode({
                nodeType: 'p',
                className: 'inputRadioLine',
                childs: [
                    `%#downloadType#%`,
                    {
                        nodeType: 'select',
                        childs: Object.keys(DownloadType).filter((i: any) => isNaN(Number(i))).map((i: string) => renderNode({
                            nodeType: 'option',
                            childs: i
                        })),
                        attributes: {
                            name: 'downloadType'
                        },
                        events: {
                            change: (e) => {
                                this.target.downloadType = (e.target as HTMLSelectElement).selectedIndex
                            }
                        }
                    }
                ]
            }) as HTMLSelectElement
            select.selectedIndex = Number(this.target.downloadType)

            return select
        }
        private configChange(item: string) {
            switch (item) {
                case 'downloadType':
                    (this.interface.querySelector(`[name=${item}]`) as HTMLSelectElement).selectedIndex = Number(this.target.downloadType)
                    this.pageChange()
                    break
                case 'checkPriority':
                    this.pageChange()
                    break
                default:
                    let element = this.interface.querySelector(`[name=${item}]`) as HTMLInputElement
                    if (element) {
                        switch (element.type) {
                            case 'radio':
                                element.value = this.target[item]
                                break
                            case 'checkbox':
                                element.checked = this.target[item]
                                break
                            case 'text':
                            case 'password':
                                element.value = this.target[item]
                                break
                            default:
                                break
                        }
                    }
                    break
            }
        }
        private pageChange() {
            while (this.interfacePage.hasChildNodes()) {
                this.interfacePage.removeChild(this.interfacePage.firstChild)
            }
            let downloadConfigInput = [
                renderNode(this.inputComponent('downloadPath')),
                renderNode(this.inputComponent('downloadProxy'))
            ]
            let aria2ConfigInput = [
                renderNode(this.inputComponent('aria2Path')),
                renderNode(this.inputComponent('aria2Token', 'password'))
            ]
            let iwaraDownloaderConfigInput = [
                renderNode(this.inputComponent('iwaraDownloaderPath')),
                renderNode(this.inputComponent('iwaraDownloaderToken', 'password'))
            ]
            let BrowserConfigInput = [
                renderNode(this.inputComponent('downloadPath'))
            ]
            switch (this.target.downloadType) {
                case DownloadType.Aria2:
                    downloadConfigInput.map(i => originalNodeAppendChild.call(this.interfacePage, i))
                    aria2ConfigInput.map(i => originalNodeAppendChild.call(this.interfacePage, i))
                    break
                default:
                    BrowserConfigInput.map(i => originalNodeAppendChild.call(this.interfacePage, i))
                    break
            }
            if (this.target.checkPriority) {
                originalNodeAppendChild.call(this.interfacePage, renderNode(this.inputComponent('downloadPriority')))
            }
        }
        public inject() {
            if (!unsafeWindow.document.querySelector('#pluginConfig')) {
                originalNodeAppendChild.call(unsafeWindow.document.body, this.interface)
                this.configChange('downloadType')
            }
        }
    }

    class menu {
        source: menu
        interface: HTMLElement
        interfacePage: HTMLElement
        constructor() {
            this.interfacePage = renderNode({
                nodeType: 'ul'
            }) as HTMLElement
            this.interface = renderNode({
                nodeType: 'div',
                attributes: {
                    id: 'pluginMenu'
                },
                childs: this.interfacePage
            }) as HTMLElement
        }
        private button(name: string, click?: (name: string, e: Event) => void) {
            return renderNode(prune({
                nodeType: 'li',
                childs: `%#${name}#%`,
                events: {
                    click: (event: Event) => {
                        click(name, event)
                        event.stopPropagation()
                        return false
                    }
                }
            }))
        }

        public inject() {
            if (!unsafeWindow.document.querySelector('#pluginMenu')) {
                new MutationObserver((mutationsList) => {
                    for (let mutation of mutationsList) {
                        if (mutation.type !== 'childList' || mutation.addedNodes.length < 1) {
                            continue;
                        }
                        let pages = ([...mutation.addedNodes].filter(i => isElement(i)) as Element[]).filter(i => i.classList.contains('page'))
                        if (pages.length < 1) {
                            continue;
                        }

                        let page = pages.find(i => i.classList.length > 1)
                        if (!page) {
                            continue;
                        }
                    }
                }).observe(unsafeWindow.document.getElementById('app'), { childList: true, subtree: true });
                originalNodeAppendChild.call(unsafeWindow.document.body, this.interface)
            }
        }
    }

    class FileInfo {
        public name: string;
        public url: URL;
        private token: string;
        private fileID: number;
        constructor(element: FileElement) {
            this.url = new URL(`${element.dtfullurl}/${element.dtsafefilenameforurl}`)
            this.name = element.dtfilename
            this.fileID = element.fileid
        }
        public async init() {
            let details = await (await fetch("https://www.iwara.zip/account/ajax/file_details", {
                "headers": {
                    "content-type": "application/x-www-form-urlencoded; charset=UTF-8"
                },
                "referrer": "https://www.iwara.zip/",
                "body": `u=${this.fileID}&p=true`,
                "method": "POST"
            })).json() as { html: string }
            this.token = details.html.among('download_token=', '\'')
            this.url.searchParams.append("download_token", this.token)
            return this
        }
    }

    GM_addStyle(GM_getResourceText('toastify-css'))
    GM_addStyle(`
        .rainbow-text {
            background-image: linear-gradient(to right, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #8b00ff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-size: 600% 100%;
            animation: rainbow 0.5s infinite linear;
        }
        @keyframes rainbow {
            0% {
                background-position: 0% 0%;
            }
            100% {
                background-position: 100% 0%;
            }
        }

        #pluginMenu {
            z-index: 2147483644;
            color: white;
            position: fixed;
            top: 50%;
            right: 0px;
            padding: 10px;
            background-color: #565656;
            border: 1px solid #ccc;
            border-radius: 5px;
            box-shadow: 0 0 10px #ccc;
            transform: translate(2%, -50%);
        }
        #pluginMenu ul {
            list-style: none;
            margin: 0;
            padding: 0;
        }
        #pluginMenu li {
            padding: 5px 10px;
            cursor: pointer;
            text-align: center;
            user-select: none;
        }
        #pluginMenu li:hover {
            background-color: #000000cc;
            border-radius: 3px;
        }

        #pluginConfig {
            color: var(--text);
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.75);
            z-index: 2147483646; 
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        #pluginConfig .main {
            background-color: var(--body);
            padding: 24px;
            margin: 10px;
            overflow-y: auto;
            width: 400px;
        }
        #pluginConfig .buttonList {
            display: flex;
            flex-direction: row;
            justify-content: center;
        }
        @media (max-width: 640px) {
            #pluginConfig .main {
                width: 100%;
            }
        }
        #pluginConfig button {
            background-color: blue;
            margin: 0px 20px 0px 20px;
            padding: 10px 20px;
            color: white;
            font-size: 18px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        #pluginConfig button {
            background-color: blue;
        }
        #pluginConfig button[disabled] {
            background-color: darkgray;
            cursor: not-allowed;
        }
        #pluginConfig p {
            display: flex;
            flex-direction: column;
        }
        #pluginConfig p label{
            display: flex;
            flex-direction: column;
            margin: 5px;
        }
        #pluginConfig .inputRadioLine {
            display: flex;
            align-items: center;
            flex-direction: row;
            justify-content: space-between;
        }
        #pluginConfig input[type="text"], #pluginConfig input[type="password"] {
            outline: none;
            border-top: none;
            border-right: none;
            border-left: none;
            border-image: initial;
            border-bottom: 1px solid var(--muted);
            line-height: 1;
            height: 30px;
            box-sizing: border-box;
            width: 100%;
            background-color: var(--body);
            color: var(--text);
        }
        #pluginConfig input[type='checkbox'].switch{
            outline: none;
            appearance: none;
            -webkit-appearance: none;
            -moz-appearance: none;
            position: relative;
            width: 40px;
            height: 20px;
            background: #ccc;
            border-radius: 10px;
            transition: border-color .2s, background-color .2s;
        }
        #pluginConfig input[type='checkbox'].switch::after {
            content: '';
            display: inline-block;
            width: 1rem;
            height: 1rem;
            border-radius: 50%;
            background: #fff;
            box-shadow: 0, 0, 2px, #999;
            transition: .2s;
            top: 2px;
            position: absolute;
            right: 55%;
        }
        #pluginConfig input[type='checkbox'].switch:checked {
            background: rgb(19, 206, 102);
        }
        #pluginConfig input[type='checkbox'].switch:checked::after {
            content: '';
            position: absolute;
            right: 2px;
            top: 2px;
        }

        #pluginOverlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.75);
            z-index: 2147483645; 
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        #pluginOverlay .main {
            color: white;
            font-size: 24px;
            width: 60%;
            background-color: rgba(64, 64, 64, 0.75);
            padding: 24px;
            margin: 10px;
            overflow-y: auto;
        }
        @media (max-width: 640px) {
            #pluginOverlay .main {
                width: 100%;
            }
        }
        #pluginOverlay button {
            padding: 10px 20px;
            color: white;
            font-size: 18px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        #pluginOverlay button {
            background-color: blue;
        }
        #pluginOverlay button[disabled] {
            background-color: darkgray;
            cursor: not-allowed;
        }
        #pluginOverlay .checkbox {
            width: 32px;
            height: 32px;
            margin: 0 4px 0 0;
            padding: 0;
        }
        #pluginOverlay .checkbox-container {
            display: flex;
            align-items: center;
            margin: 0 0 10px 0;
        }
        #pluginOverlay .checkbox-label {
            color: white;
            font-size: 32px;
            font-weight: bold;
            margin-left: 10px;
            display: flex;
            align-items: center;
        }

        .toastify h3 {
            margin: 0 0 10px 0;
        }
        .toastify p {
            margin: 0 ;
        }
    `)
    var i18n = new I18N()
    var config = new Config()
    var editConfig = new configEdit(config)
    var pluginMenu = new menu()

    async function analyzeDownloadTask() {
        let list = document.querySelectorAll('div[fileid]') as NodeListOf<FileElement>
        let size = list.length
        let node = renderNode({
            nodeType: 'p',
            childs: `%#parsingProgress#%[${list.length}/${size}]`
        })
        let start = newToast(ToastType.Info, {
            node: node,
            duration: -1
        })
        start.showToast()

        for (let index = 0; index < list.length; index++) {
            const element = list[index];
            let fileInfo = await (new FileInfo(element)).init()
            switch (config.downloadType) {
                case DownloadType.Aria2:
                   await aria2Download(fileInfo)
                    break;
                    case DownloadType.Browser:
                    
                    break;
                default:
                    break;
            }
            node.firstChild.textContent = `${i18n[language()].parsingProgress}[${list.length - (index + 1)}/${size}]`
        }
        start.hideToast()
        if (size != 1) {
            let completed = newToast(
                ToastType.Info,
                {
                    text: `%#allCompleted#%`,
                    duration: -1,
                    close: true,
                    onClick() {
                        completed.hideToast()
                    }
                }
            )
            completed.showToast()
        }
    }

    function toastNode(body: RenderCode | RenderCode[], title?: string): Element | Node {
        return renderNode({
            nodeType: 'div',
            childs: [
                !isNull(title) && !title.isEmpty() ? {
                    nodeType: 'h3',
                    childs: `%#appName#% - ${title}`
                } : {
                    nodeType: 'h3',
                    childs: '%#appName#%'
                }
                ,
                {
                    nodeType: 'p',
                    childs: body
                }
            ]
        })
    }
    function getTextNode(node: Node | Element): string {
        return node.nodeType === Node.TEXT_NODE
            ? node.textContent || ''
            : node.nodeType === Node.ELEMENT_NODE
                ? Array.from(node.childNodes)
                    .map(getTextNode)
                    .join('')
                : ''
    }
    function newToast(type: ToastType, params?: Toastify.Options) {
        const logFunc = {
            [ToastType.Warn]: console.warn,
            [ToastType.Error]: console.error,
            [ToastType.Log]: console.log,
            [ToastType.Info]: console.info,
        }[type] || console.log
        params = Object.assign({
            newWindow: true,
            gravity: 'top',
            position: 'left',
            stopOnFocus: true
        },
            type === ToastType.Warn && {
                duration: -1,
                style: {
                    background: 'linear-gradient(-30deg, rgb(119 76 0), rgb(255 165 0))'
                }
            },
            type === ToastType.Error && {
                duration: -1,
                style: {
                    background: 'linear-gradient(-30deg, rgb(108 0 0), rgb(215 0 0))'
                }
            },
            !isNull(params) && params
        )
        if (!isNull(params.text)) {
            params.text = params.text.replaceVariable(i18n[language()]).toString()
        }
        logFunc((!isNull(params.text) ? params.text : !isNull(params.node) ? getTextNode(params.node) : 'undefined').replaceVariable(i18n[language()]))
        return Toastify(params)
    }

    function analyzeLocalPath(path: string): LocalPath {
        let matchPath = path.replaceAll('//', '/').replaceAll('\\\\', '/').match(/^([a-zA-Z]:)?[\/\\]?([^\/\\]+[\/\\])*([^\/\\]+\.\w+)$/)
        if (isNull(matchPath)) throw new Error(`%#downloadPathError#%["${path}"]`)
        try {
            return {
                fullPath: matchPath[0],
                drive: matchPath[1] || '',
                filename: matchPath[3]
            }
        } catch (error) {
            throw new Error(`%#downloadPathError#% ["${matchPath.join(',')}"]`)
        }
    }

    function aria2Download(fileInfo: FileInfo) {
        (async function (name: string, downloadUrl: URL) {
            let localPath = analyzeLocalPath(config.downloadPath.replaceVariable(
                {
                    NowTime: new Date(),
                    TITLE: name
                }
            ).trim())

            let res = await aria2API('aria2.addUri', [
                [downloadUrl.href],
                prune({
                    'all-proxy': config.downloadProxy,
                    'out': localPath.filename,
                    'dir': localPath.fullPath.replace(localPath.filename, ''),
                    'referer': window.location.hostname,
                    'header': [
                        'Cookie:' + unsafeWindow.document.cookie
                    ]
                })
            ])
            console.log(`Aria2 ${name} ${JSON.stringify(res)}`)
            newToast(
                ToastType.Info,
                {
                    node: toastNode(`${name} %#pushTaskSucceed#%`)
                }
            ).showToast()
        }(fileInfo.name, fileInfo.url))
    }

    function othersDownload(fileInfo: FileInfo) {
        (async function (Name: string, DownloadUrl: URL) {
            DownloadUrl.searchParams.set('download', analyzeLocalPath(config.downloadPath.replaceVariable(
                {
                    NowTime: new Date(),
                    TITLE: Name
                }
            ).trim()).filename)
            GM_openInTab(DownloadUrl.href, { active: false, insert: true, setParent: true })
        }(fileInfo.name, fileInfo.url))
    }
    function browserDownload(fileInfo: FileInfo) {
        (async function ( Name: string, DownloadUrl: URL) {
            function browserDownloadError(error: Tampermonkey.DownloadErrorResponse | Error) {
                let errorInfo = getString(Error)
                if (!(error instanceof Error)) {
                    errorInfo = {
                        'not_enabled': `%#browserDownloadNotEnabled#%`,
                        'not_whitelisted': `%#browserDownloadNotWhitelisted#%`,
                        'not_permitted': `%#browserDownloadNotPermitted#%`,
                        'not_supported': `%#browserDownloadNotSupported#%`,
                        'not_succeeded': `%#browserDownloadNotSucceeded#% ${error.details ?? getString(error.details)}`
                    }[error.error] || `%#browserDownloadUnknownError#%`
                }
                let toast = newToast(
                    ToastType.Error,
                    {
                        node: toastNode([
                            `${Name} %#downloadFailed#%`,
                            { nodeType: 'br' },
                            errorInfo,
                            { nodeType: 'br' },
                            `%#tryRestartingDownload#%`
                        ], '%#browserDownload#%'),
                        async onClick() {
                            toast.hideToast()
                            
                        }
                    }
                )
                toast.showToast()
            }
            GM_download({
                url: DownloadUrl.href,
                saveAs: false,
                name: config.downloadPath.replaceVariable(
                    {
                        NowTime: new Date(),
                        TITLE: Name
                    }
                ).trim(),
                onerror: (err) => browserDownloadError(err),
                ontimeout: () => browserDownloadError(new Error('%#browserDownloadTimeout#%'))
            })
        }(fileInfo.name, fileInfo.url))
    }
    async function aria2API(method: string, params: any) {
        return await (await fetch(config.aria2Path, {
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: method,
                id: UUID(),
                params: [`token:${config.aria2Token}`, ...params]
            }),
            method: 'POST'
        })).json()
    }
    async function EnvCheck(): Promise<boolean> {
        try {
            if (GM_info.downloadMode !== 'browser') {
                GM_getValue('isDebug') && console.log(GM_info)
                throw new Error('%#browserDownloadModeError#%')
            }
        } catch (error: any) {
            let toast = newToast(
                ToastType.Error,
                {
                    node: toastNode([
                        `%#configError#%`,
                        { nodeType: 'br' },
                        getString(error)
                    ], '%#settingsCheck#%'),
                    position: 'center',
                    onClick() {
                        toast.hideToast()
                    }
                }
            )
            toast.showToast()
            return false
        }
        return true
    }
    async function aria2Check(): Promise<boolean> {
        try {
            let res = await (await fetch(config.aria2Path, {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    'jsonrpc': '2.0',
                    'method': 'aria2.tellActive',
                    'id': UUID(),
                    'params': ['token:' + config.aria2Token]
                })
            })).json()
            if (res.error) {
                throw new Error(res.error.message)
            }
        } catch (error: any) {
            let toast = newToast(
                ToastType.Error,
                {
                    node: toastNode([
                        `Aria2 RPC %#connectionTest#%`,
                        { nodeType: 'br' },
                        getString(error)
                    ], '%#settingsCheck#%'),
                    position: 'center',
                    onClick() {
                        toast.hideToast()
                    }
                }
            )
            toast.showToast()
            return false
        }
        return true
    }

    function firstRun() {
        console.log('First run config reset!')
        GM_listValues().forEach(i => GM_deleteValue(i))
        config = new Config()
        editConfig = new configEdit(config)
        let confirmButton = renderNode({
            nodeType: 'button',
            attributes: {
                disabled: true,
                title: i18n[language()].ok
            },
            childs: '%#ok#%',
            events: {
                click: () => {
                    GM_setValue('isFirstRun', false)
                    GM_setValue('version', GM_info.script.version)
                    unsafeWindow.document.querySelector('#pluginOverlay').remove()
                    editConfig.inject()
                }
            }
        }) as HTMLButtonElement
        originalNodeAppendChild.call(unsafeWindow.document.body, renderNode({
            nodeType: 'div',
            attributes: {
                id: 'pluginOverlay'
            },
            childs: [
                {
                    nodeType: 'div',
                    className: 'main',
                    childs: [
                        { nodeType: 'p', childs: '%#useHelpForBase#%' }
                    ]
                },
                {
                    nodeType: 'div',
                    className: 'checkbox-container',
                    childs: {
                        nodeType: 'label',
                        className: ['checkbox-label', 'rainbow-text'],
                        childs: [{
                            nodeType: 'input',
                            className: 'checkbox',
                            attributes: {
                                type: 'checkbox',
                                name: 'agree-checkbox'
                            },
                            events: {
                                change: (event: Event) => {
                                    confirmButton.disabled = !(event.target as HTMLInputElement).checked
                                }
                            }
                        }, '%#alreadyKnowHowToUse#%'
                        ]
                    }
                },
                confirmButton
            ]
        }))
    }

    async function main() {
        if (GM_getValue('isFirstRun', true)) {
            firstRun()
            return
        }
        if (!await config.check()) {
            newToast(ToastType.Info, {
                text: `%#configError#%`,
                duration: 60 * 1000,
            }).showToast()
            editConfig.inject()
            return
        }
        GM_setValue('version', GM_info.script.version)

        let notice = newToast(
            ToastType.Info,
            {
                node: toastNode([
                    `加载完成`,
                    { nodeType: 'br' },
                    `公告: `,
                    ...i18n[language()].notice as RenderCode[]
                ]),
                duration: 10000,
                gravity: 'bottom',
                position: 'center',
                onClick() {
                    notice.hideToast()
                }
            }
        )
        notice.showToast()
    }

    if (new Version(GM_getValue('version', '0.0.0')).compare(new Version('0.0.1')) === VersionState.Low) {
        GM_setValue('isFirstRun', true)
        alert(i18n[language()].configurationIncompatible)
    }

    (unsafeWindow.document.body ? Promise.resolve() : new Promise(resolve => originalAddEventListener.call(unsafeWindow.document, "DOMContentLoaded", resolve))).then(main)
})();

