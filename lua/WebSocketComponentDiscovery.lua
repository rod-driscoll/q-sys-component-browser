-- ========== START: WebSocket Component Discovery ==========
--[[
  WebSocketComponentDiscovery.lua
  Discovers all components and their controls in the Q-SYS design
  Sends results via WebSocket to avoid overwhelming the log system

  Usage in webserver component's code control:
  1. Set up the HTTP server with WebSocket endpoint
  2. When client connects to /ws/discovery, send component data
  3. Handles large payloads by chunking if needed
]]

--------------------- 'qsys-http-server' --------------------- 
HttpServer = (function()

  local HTTP_METHODS = {
    'CHECKOUT',
    'COPY',
    'DELETE',
    'GET',
    'HEAD',
    'LOCK',
    'MERGE',
    'MKACTIVITY',
    'MKCOL',
    'MOVE',
    'M-SEARCH',
    'NOTIFY',
    'OPTIONS',
    'PATCH',
    'POST',
    'PURGE',
    'PUT',
    'REPORT',
    'SEARCH',
    'SUBSCRIBE',
    'TRACE',
    'UNLOCK',
    'UNSUBSCRIBE'
  };
  
  local HTTP_CODES = {
    [100] = 'Continue',
    [101] = 'Switching Protocols',
    [102] = 'Processing',
    [200] = 'OK',
    [201] = 'Created',
    [202] = 'Accepted',
    [203] = 'Non-Authoritative Information',
    [204] = 'No Content',
    [205] = 'Reset Content',
    [206] = 'Partial Content',
    [207] = 'Multi-Status',
    [208] = 'Already Reported',
    [226] = 'IM Used',
    [300] = 'Multiple Choices',
    [301] = 'Moved Permanently',
    [302] = 'Found',
    [303] = 'See Other',
    [304] = 'Not Modified',
    [305] = 'Use Proxy',
    [306] = 'Reserved',
    [307] = 'Temporary Redirect',
    [308] = 'Permanent Redirect',
    [400] = 'Bad Request',
    [401] = 'Unauthorized',
    [402] = 'Payment Required',
    [403] = 'Forbidden',
    [404] = 'Not Found',
    [405] = 'Method Not Allowed',
    [406] = 'Not Acceptable',
    [407] = 'Proxy Authentication Required',
    [408] = 'Request Timeout',
    [409] = 'Conflict',
    [410] = 'Gone',
    [411] = 'Length Required',
    [412] = 'Precondition Failed',
    [413] = 'Request Entity Too Large',
    [414] = 'Request-URI Too Long',
    [415] = 'Unsupported Media Type',
    [416] = 'Requested Range Not Satisfiable',
    [417] = 'Expectation Failed',
    [422] = 'Unprocessable Entity',
    [423] = 'Locked',
    [424] = 'Failed Dependency',
    [425] = 'Unassigned',
    [426] = 'Upgrade Required',
    [427] = 'Unassigned',
    [428] = 'Precondition Required',
    [429] = 'Too Many Requests',
    [430] = 'Unassigned',
    [431] = 'Request Header Fields Too Large',
    [500] = 'Internal Server Error',
    [501] = 'Not Implemented',
    [502] = 'Bad Gateway',
    [503] = 'Service Unavailable',
    [504] = 'Gateway Timeout',
    [505] = 'HTTP Version Not Supported',
    [506] = 'Variant Also Negotiates (Experimental)',
    [507] = 'Insufficient Storage',
    [508] = 'Loop Detected',
    [509] = 'Unassigned', 
    [510] = 'Not Extended',
    [511] = 'Network Authentication Required'
  };

 local MIME_HEADERS = {
    ['123'] = 'application/vnd.lotus-1-2-3',
    ['3dml'] = 'text/vnd.in3d.3dml',
    ['3ds'] = 'image/x-3ds',
    ['3g2'] = 'video/3gpp2',
    ['3gp'] = 'video/3gpp',
    ['7z'] = 'application/x-7z-compressed',
    ['aab'] = 'application/x-authorware-bin',
    ['aac'] = 'audio/x-aac',
    ['aam'] = 'application/x-authorware-map',
    ['aas'] = 'application/x-authorware-seg',
    ['abw'] = 'application/x-abiword',
    ['ac'] = 'application/pkix-attr-cert',
    ['acc'] = 'application/vnd.americandynamics.acc',
    ['ace'] = 'application/x-ace-compressed',
    ['acu'] = 'application/vnd.acucobol',
    ['acutc'] = 'application/vnd.acucorp',
    ['adp'] = 'audio/adpcm',
    ['aep'] = 'application/vnd.audiograph',
    ['afm'] = 'application/x-font-type1',
    ['afp'] = 'application/vnd.ibm.modcap',
    ['ahead'] = 'application/vnd.ahead.space',
    ['ai'] = 'application/postscript',
    ['aif'] = 'audio/x-aiff',
    ['aifc'] = 'audio/x-aiff',
    ['aiff'] = 'audio/x-aiff',
    ['air'] = 'application/vnd.adobe.air-application-installer-package+zip',
    ['ait'] = 'application/vnd.dvb.ait',
    ['ami'] = 'application/vnd.amiga.ami',
    ['apk'] = 'application/vnd.android.package-archive',
    ['appcache'] = 'text/cache-manifest',
    ['application'] = 'application/x-ms-application',
    ['apr'] = 'application/vnd.lotus-approach',
    ['arc'] = 'application/x-freearc',
    ['asc'] = 'application/pgp-signature',
    ['asf'] = 'video/x-ms-asf',
    ['asm'] = 'text/x-asm',
    ['aso'] = 'application/vnd.accpac.simply.aso',
    ['asx'] = 'video/x-ms-asf',
    ['atc'] = 'application/vnd.acucorp',
    ['atom'] = 'application/atom+xml',
    ['atomcat'] = 'application/atomcat+xml',
    ['atomsvc'] = 'application/atomsvc+xml',
    ['atx'] = 'application/vnd.antix.game-component',
    ['au'] = 'audio/basic',
    ['avi'] = 'video/x-msvideo',
    ['avif'] = 'image/avif',
    ['aw'] = 'application/applixware',
    ['azf'] = 'application/vnd.airzip.filesecure.azf',
    ['azs'] = 'application/vnd.airzip.filesecure.azs',
    ['azw'] = 'application/vnd.amazon.ebook',
    ['bat'] = 'application/x-msdownload',
    ['bcpio'] = 'application/x-bcpio',
    ['bdf'] = 'application/x-font-bdf',
    ['bdm'] = 'application/vnd.syncml.dm+wbxml',
    ['bed'] = 'application/vnd.realvnc.bed',
    ['bh2'] = 'application/vnd.fujitsu.oasysprs',
    ['bin'] = 'application/octet-stream',
    ['blb'] = 'application/x-blorb',
    ['blorb'] = 'application/x-blorb',
    ['bmi'] = 'application/vnd.bmi',
    ['bmp'] = 'image/bmp',
    ['book'] = 'application/vnd.framemaker',
    ['box'] = 'application/vnd.previewsystems.box',
    ['boz'] = 'application/x-bzip2',
    ['bpk'] = 'application/octet-stream',
    ['btif'] = 'image/prs.btif',
    ['bz'] = 'application/x-bzip',
    ['bz2'] = 'application/x-bzip2',
    ['c'] = 'text/x-c',
    ['c11amc'] = 'application/vnd.cluetrust.cartomobile-config',
    ['c11amz'] = 'application/vnd.cluetrust.cartomobile-config-pkg',
    ['c4d'] = 'application/vnd.clonk.c4group',
    ['c4f'] = 'application/vnd.clonk.c4group',
    ['c4g'] = 'application/vnd.clonk.c4group',
    ['c4p'] = 'application/vnd.clonk.c4group',
    ['c4u'] = 'application/vnd.clonk.c4group',
    ['cab'] = 'application/vnd.ms-cab-compressed',
    ['caf'] = 'audio/x-caf',
    ['cap'] = 'application/vnd.tcpdump.pcap',
    ['car'] = 'application/vnd.curl.car',
    ['cat'] = 'application/vnd.ms-pki.seccat',
    ['cb7'] = 'application/x-cbr',
    ['cba'] = 'application/x-cbr',
    ['cbr'] = 'application/x-cbr',
    ['cbt'] = 'application/x-cbr',
    ['cbz'] = 'application/x-cbr',
    ['cc'] = 'text/x-c',
    ['cct'] = 'application/x-director',
    ['ccxml'] = 'application/ccxml+xml',
    ['cdbcmsg'] = 'application/vnd.contact.cmsg',
    ['cdf'] = 'application/x-netcdf',
    ['cdkey'] = 'application/vnd.mediastation.cdkey',
    ['cdmia'] = 'application/cdmi-capability',
    ['cdmic'] = 'application/cdmi-container',
    ['cdmid'] = 'application/cdmi-domain',
    ['cdmio'] = 'application/cdmi-object',
    ['cdmiq'] = 'application/cdmi-queue',
    ['cdx'] = 'chemical/x-cdx',
    ['cdxml'] = 'application/vnd.chemdraw+xml',
    ['cdy'] = 'application/vnd.cinderella',
    ['cer'] = 'application/pkix-cert',
    ['cfs'] = 'application/x-cfs-compressed',
    ['cgm'] = 'image/cgm',
    ['chat'] = 'application/x-chat',
    ['chm'] = 'application/vnd.ms-htmlhelp',
    ['chrt'] = 'application/vnd.kde.kchart',
    ['cif'] = 'chemical/x-cif',
    ['cii'] = 'application/vnd.anser-web-certificate-issue-initiation',
    ['cil'] = 'application/vnd.ms-artgalry',
    ['cla'] = 'application/vnd.claymore',
    ['class'] = 'application/java-vm',
    ['clkk'] = 'application/vnd.crick.clicker.keyboard',
    ['clkp'] = 'application/vnd.crick.clicker.palette',
    ['clkt'] = 'application/vnd.crick.clicker.template',
    ['clkw'] = 'application/vnd.crick.clicker.wordbank',
    ['clkx'] = 'application/vnd.crick.clicker',
    ['clp'] = 'application/x-msclip',
    ['cmc'] = 'application/vnd.cosmocaller',
    ['cmdf'] = 'chemical/x-cmdf',
    ['cml'] = 'chemical/x-cml',
    ['cmp'] = 'application/vnd.yellowriver-custom-menu',
    ['cmx'] = 'image/x-cmx',
    ['cod'] = 'application/vnd.rim.cod',
    ['com'] = 'application/x-msdownload',
    ['conf'] = 'text/plain',
    ['cpio'] = 'application/x-cpio',
    ['cpp'] = 'text/x-c',
    ['cpt'] = 'application/mac-compactpro',
    ['crd'] = 'application/x-mscardfile',
    ['crl'] = 'application/pkix-crl',
    ['crt'] = 'application/x-x509-ca-cert',
    ['cryptonote'] = 'application/vnd.rig.cryptonote',
    ['csh'] = 'application/x-csh',
    ['csml'] = 'chemical/x-csml',
    ['csp'] = 'application/vnd.commonspace',
    ['css'] = 'text/css',
    ['cst'] = 'application/x-director',
    ['csv'] = 'text/csv',
    ['cu'] = 'application/cu-seeme',
    ['curl'] = 'text/vnd.curl',
    ['cww'] = 'application/prs.cww',
    ['cxt'] = 'application/x-director',
    ['cxx'] = 'text/x-c',
    ['dae'] = 'model/vnd.collada+xml',
    ['daf'] = 'application/vnd.mobius.daf',
    ['dart'] = 'application/vnd.dart',
    ['dataless'] = 'application/vnd.fdsn.seed',
    ['davmount'] = 'application/davmount+xml',
    ['dbk'] = 'application/docbook+xml',
    ['dcr'] = 'application/x-director',
    ['dcurl'] = 'text/vnd.curl.dcurl',
    ['dd2'] = 'application/vnd.oma.dd2+xml',
    ['ddd'] = 'application/vnd.fujixerox.ddd',
    ['deb'] = 'application/x-debian-package',
    ['def'] = 'text/plain',
    ['deploy'] = 'application/octet-stream',
    ['der'] = 'application/x-x509-ca-cert',
    ['dfac'] = 'application/vnd.dreamfactory',
    ['dgc'] = 'application/x-dgc-compressed',
    ['dic'] = 'text/x-c',
    ['dir'] = 'application/x-director',
    ['dis'] = 'application/vnd.mobius.dis',
    ['dist'] = 'application/octet-stream',
    ['distz'] = 'application/octet-stream',
    ['djv'] = 'image/vnd.djvu',
    ['djvu'] = 'image/vnd.djvu',
    ['dll'] = 'application/x-msdownload',
    ['dmg'] = 'application/x-apple-diskimage',
    ['dmp'] = 'application/vnd.tcpdump.pcap',
    ['dms'] = 'application/octet-stream',
    ['dna'] = 'application/vnd.dna',
    ['doc'] = 'application/msword',
    ['docm'] = 'application/vnd.ms-word.document.macroenabled.12',
    ['docx'] = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ['dot'] = 'application/msword',
    ['dotm'] = 'application/vnd.ms-word.template.macroenabled.12',
    ['dotx'] = 'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
    ['dp'] = 'application/vnd.osgi.dp',
    ['dpg'] = 'application/vnd.dpgraph',
    ['dra'] = 'audio/vnd.dra',
    ['dsc'] = 'text/prs.lines.tag',
    ['dssc'] = 'application/dssc+der',
    ['dtb'] = 'application/x-dtbook+xml',
    ['dtd'] = 'application/xml-dtd',
    ['dts'] = 'audio/vnd.dts',
    ['dtshd'] = 'audio/vnd.dts.hd',
    ['dump'] = 'application/octet-stream',
    ['dvb'] = 'video/vnd.dvb.file',
    ['dvi'] = 'application/x-dvi',
    ['dwf'] = 'model/vnd.dwf',
    ['dwg'] = 'image/vnd.dwg',
    ['dxf'] = 'image/vnd.dxf',
    ['dxp'] = 'application/vnd.spotfire.dxp',
    ['dxr'] = 'application/x-director',
    ['ecelp4800'] = 'audio/vnd.nuera.ecelp4800',
    ['ecelp7470'] = 'audio/vnd.nuera.ecelp7470',
    ['ecelp9600'] = 'audio/vnd.nuera.ecelp9600',
    ['ecma'] = 'application/ecmascript',
    ['edm'] = 'application/vnd.novadigm.edm',
    ['edx'] = 'application/vnd.novadigm.edx',
    ['efif'] = 'application/vnd.picsel',
    ['ei6'] = 'application/vnd.pg.osasli',
    ['elc'] = 'application/octet-stream',
    ['emf'] = 'application/x-msmetafile',
    ['eml'] = 'message/rfc822',
    ['emma'] = 'application/emma+xml',
    ['emz'] = 'application/x-msmetafile',
    ['eol'] = 'audio/vnd.digital-winds',
    ['eot'] = 'application/vnd.ms-fontobject',
    ['eps'] = 'application/postscript',
    ['epub'] = 'application/epub+zip',
    ['es3'] = 'application/vnd.eszigno3+xml',
    ['esa'] = 'application/vnd.osgi.subsystem',
    ['esf'] = 'application/vnd.epson.esf',
    ['et3'] = 'application/vnd.eszigno3+xml',
    ['etx'] = 'text/x-setext',
    ['eva'] = 'application/x-eva',
    ['evy'] = 'application/x-envoy',
    ['exe'] = 'application/x-msdownload',
    ['exi'] = 'application/exi',
    ['ext'] = 'application/vnd.novadigm.ext',
    ['ez'] = 'application/andrew-inset',
    ['ez2'] = 'application/vnd.ezpix-album',
    ['ez3'] = 'application/vnd.ezpix-package',
    ['f'] = 'text/x-fortran',
    ['f4v'] = 'video/x-f4v',
    ['f77'] = 'text/x-fortran',
    ['f90'] = 'text/x-fortran',
    ['fbs'] = 'image/vnd.fastbidsheet',
    ['fcdt'] = 'application/vnd.adobe.formscentral.fcdt',
    ['fcs'] = 'application/vnd.isac.fcs',
    ['fdf'] = 'application/vnd.fdf',
    ['fe_launch'] = 'application/vnd.denovo.fcselayout-link',
    ['fg5'] = 'application/vnd.fujitsu.oasysgp',
    ['fgd'] = 'application/x-director',
    ['fh'] = 'image/x-freehand',
    ['fh4'] = 'image/x-freehand',
    ['fh5'] = 'image/x-freehand',
    ['fh7'] = 'image/x-freehand',
    ['fhc'] = 'image/x-freehand',
    ['fig'] = 'application/x-xfig',
    ['flac'] = 'audio/x-flac',
    ['fli'] = 'video/x-fli',
    ['flo'] = 'application/vnd.micrografx.flo',
    ['flv'] = 'video/x-flv',
    ['flw'] = 'application/vnd.kde.kivio',
    ['flx'] = 'text/vnd.fmi.flexstor',
    ['fly'] = 'text/vnd.fly',
    ['fm'] = 'application/vnd.framemaker',
    ['fnc'] = 'application/vnd.frogans.fnc',
    ['for'] = 'text/x-fortran',
    ['fpx'] = 'image/vnd.fpx',
    ['frame'] = 'application/vnd.framemaker',
    ['fsc'] = 'application/vnd.fsc.weblaunch',
    ['fst'] = 'image/vnd.fst',
    ['ftc'] = 'application/vnd.fluxtime.clip',
    ['fti'] = 'application/vnd.anser-web-funds-transfer-initiation',
    ['fvt'] = 'video/vnd.fvt',
    ['fxp'] = 'application/vnd.adobe.fxp',
    ['fxpl'] = 'application/vnd.adobe.fxp',
    ['fzs'] = 'application/vnd.fuzzysheet',
    ['g2w'] = 'application/vnd.geoplan',
    ['g3'] = 'image/g3fax',
    ['g3w'] = 'application/vnd.geospace',
    ['gac'] = 'application/vnd.groove-account',
    ['gam'] = 'application/x-tads',
    ['gbr'] = 'application/rpki-ghostbusters',
    ['gca'] = 'application/x-gca-compressed',
    ['gdl'] = 'model/vnd.gdl',
    ['geo'] = 'application/vnd.dynageo',
    ['gex'] = 'application/vnd.geometry-explorer',
    ['ggb'] = 'application/vnd.geogebra.file',
    ['ggs'] = 'application/vnd.geogebra.slides',
    ['ggt'] = 'application/vnd.geogebra.tool',
    ['ghf'] = 'application/vnd.groove-help',
    ['gif'] = 'image/gif',
    ['gim'] = 'application/vnd.groove-identity-message',
    ['gml'] = 'application/gml+xml',
    ['gmx'] = 'application/vnd.gmx',
    ['gnumeric'] = 'application/x-gnumeric',
    ['gph'] = 'application/vnd.flographit',
    ['gpx'] = 'application/gpx+xml',
    ['gqf'] = 'application/vnd.grafeq',
    ['gqs'] = 'application/vnd.grafeq',
    ['gram'] = 'application/srgs',
    ['gramps'] = 'application/x-gramps-xml',
    ['gre'] = 'application/vnd.geometry-explorer',
    ['grv'] = 'application/vnd.groove-injector',
    ['grxml'] = 'application/srgs+xml',
    ['gsf'] = 'application/x-font-ghostscript',
    ['gtar'] = 'application/x-gtar',
    ['gtm'] = 'application/vnd.groove-tool-message',
    ['gtw'] = 'model/vnd.gtw',
    ['gv'] = 'text/vnd.graphviz',
    ['gxf'] = 'application/gxf',
    ['gxt'] = 'application/vnd.geonext',
    ['h'] = 'text/x-c',
    ['h261'] = 'video/h261',
    ['h263'] = 'video/h263',
    ['h264'] = 'video/h264',
    ['hal'] = 'application/vnd.hal+xml',
    ['hbci'] = 'application/vnd.hbci',
    ['hdf'] = 'application/x-hdf',
    ['hh'] = 'text/x-c',
    ['hlp'] = 'application/winhlp',
    ['hpgl'] = 'application/vnd.hp-hpgl',
    ['hpid'] = 'application/vnd.hp-hpid',
    ['hps'] = 'application/vnd.hp-hps',
    ['hqx'] = 'application/mac-binhex40',
    ['htke'] = 'application/vnd.kenameaapp',
    ['htm'] = 'text/html',
    ['html'] = 'text/html',
    ['hvd'] = 'application/vnd.yamaha.hv-dic',
    ['hvp'] = 'application/vnd.yamaha.hv-voice',
    ['hvs'] = 'application/vnd.yamaha.hv-script',
    ['i2g'] = 'application/vnd.intergeo',
    ['icc'] = 'application/vnd.iccprofile',
    ['ice'] = 'x-conference/x-cooltalk',
    ['icm'] = 'application/vnd.iccprofile',
    ['ico'] = 'image/x-icon',
    ['ics'] = 'text/calendar',
    ['ief'] = 'image/ief',
    ['ifb'] = 'text/calendar',
    ['ifm'] = 'application/vnd.shana.informed.formdata',
    ['iges'] = 'model/iges',
    ['igl'] = 'application/vnd.igloader',
    ['igm'] = 'application/vnd.insors.igm',
    ['igs'] = 'model/iges',
    ['igx'] = 'application/vnd.micrografx.igx',
    ['iif'] = 'application/vnd.shana.informed.interchange',
    ['imp'] = 'application/vnd.accpac.simply.imp',
    ['ims'] = 'application/vnd.ms-ims',
    ['in'] = 'text/plain',
    ['ink'] = 'application/inkml+xml',
    ['inkml'] = 'application/inkml+xml',
    ['install'] = 'application/x-install-instructions',
    ['iota'] = 'application/vnd.astraea-software.iota',
    ['ipfix'] = 'application/ipfix',
    ['ipk'] = 'application/vnd.shana.informed.package',
    ['irm'] = 'application/vnd.ibm.rights-management',
    ['irp'] = 'application/vnd.irepository.package+xml',
    ['iso'] = 'application/x-iso9660-image',
    ['itp'] = 'application/vnd.shana.informed.formtemplate',
    ['ivp'] = 'application/vnd.immervision-ivp',
    ['ivu'] = 'application/vnd.immervision-ivu',
    ['jad'] = 'text/vnd.sun.j2me.app-descriptor',
    ['jam'] = 'application/vnd.jam',
    ['jar'] = 'application/java-archive',
    ['java'] = 'text/x-java-source',
    ['jisp'] = 'application/vnd.jisp',
    ['jlt'] = 'application/vnd.hp-jlyt',
    ['jnlp'] = 'application/x-java-jnlp-file',
    ['joda'] = 'application/vnd.joost.joda-archive',
    ['jpe'] = 'image/jpeg',
    ['jpeg'] = 'image/jpeg',
    ['jpg'] = 'image/jpeg',
    ['jpgm'] = 'video/jpm',
    ['jpgv'] = 'video/jpeg',
    ['jpm'] = 'video/jpm',
    ['js'] = 'text/javascript',
    ['json'] = 'application/json',
    ['jsonml'] = 'application/jsonml+json',
    ['jxl'] = 'image/jxl',
    ['kar'] = 'audio/midi',
    ['karbon'] = 'application/vnd.kde.karbon',
    ['kfo'] = 'application/vnd.kde.kformula',
    ['kia'] = 'application/vnd.kidspiration',
    ['kml'] = 'application/vnd.google-earth.kml+xml',
    ['kmz'] = 'application/vnd.google-earth.kmz',
    ['kne'] = 'application/vnd.kinar',
    ['knp'] = 'application/vnd.kinar',
    ['kon'] = 'application/vnd.kde.kontour',
    ['kpr'] = 'application/vnd.kde.kpresenter',
    ['kpt'] = 'application/vnd.kde.kpresenter',
    ['kpxx'] = 'application/vnd.ds-keypoint',
    ['ksp'] = 'application/vnd.kde.kspread',
    ['ktr'] = 'application/vnd.kahootz',
    ['ktx'] = 'image/ktx',
    ['ktz'] = 'application/vnd.kahootz',
    ['kwd'] = 'application/vnd.kde.kword',
    ['kwt'] = 'application/vnd.kde.kword',
    ['lasxml'] = 'application/vnd.las.las+xml',
    ['latex'] = 'application/x-latex',
    ['lbd'] = 'application/vnd.llamagraphics.life-balance.desktop',
    ['lbe'] = 'application/vnd.llamagraphics.life-balance.exchange+xml',
    ['les'] = 'application/vnd.hhe.lesson-player',
    ['lha'] = 'application/x-lzh-compressed',
    ['link66'] = 'application/vnd.route66.link66+xml',
    ['list'] = 'text/plain',
    ['list3820'] = 'application/vnd.ibm.modcap',
    ['listafp'] = 'application/vnd.ibm.modcap',
    ['lnk'] = 'application/x-ms-shortcut',
    ['log'] = 'text/plain',
    ['lostxml'] = 'application/lost+xml',
    ['lrf'] = 'application/octet-stream',
    ['lrm'] = 'application/vnd.ms-lrm',
    ['ltf'] = 'application/vnd.frogans.ltf',
    ['lvp'] = 'audio/vnd.lucent.voice',
    ['lwp'] = 'application/vnd.lotus-wordpro',
    ['lzh'] = 'application/x-lzh-compressed',
    ['m13'] = 'application/x-msmediaview',
    ['m14'] = 'application/x-msmediaview',
    ['m1v'] = 'video/mpeg',
    ['m21'] = 'application/mp21',
    ['m2a'] = 'audio/mpeg',
    ['m2t'] = 'video/mp2t',
    ['m2ts'] = 'video/mp2t',
    ['m2v'] = 'video/mpeg',
    ['m3a'] = 'audio/mpeg',
    ['m3u'] = 'audio/x-mpegurl',
    ['m3u8'] = 'application/vnd.apple.mpegurl',
    ['m4a'] = 'audio/mp4',
    ['m4u'] = 'video/vnd.mpegurl',
    ['m4v'] = 'video/x-m4v',
    ['ma'] = 'application/mathematica',
    ['mads'] = 'application/mads+xml',
    ['mag'] = 'application/vnd.ecowin.chart',
    ['maker'] = 'application/vnd.framemaker',
    ['man'] = 'text/troff',
    ['mar'] = 'application/octet-stream',
    ['mathml'] = 'application/mathml+xml',
    ['mb'] = 'application/mathematica',
    ['mbk'] = 'application/vnd.mobius.mbk',
    ['mbox'] = 'application/mbox',
    ['mc1'] = 'application/vnd.medcalcdata',
    ['mcd'] = 'application/vnd.mcd',
    ['mcurl'] = 'text/vnd.curl.mcurl',
    ['mdb'] = 'application/x-msaccess',
    ['mdi'] = 'image/vnd.ms-modi',
    ['me'] = 'text/troff',
    ['mesh'] = 'model/mesh',
    ['meta4'] = 'application/metalink4+xml',
    ['metalink'] = 'application/metalink+xml',
    ['mets'] = 'application/mets+xml',
    ['mfm'] = 'application/vnd.mfmp',
    ['mft'] = 'application/rpki-manifest',
    ['mgp'] = 'application/vnd.osgeo.mapguide.package',
    ['mgz'] = 'application/vnd.proteus.magazine',
    ['mid'] = 'audio/midi',
    ['midi'] = 'audio/midi',
    ['mie'] = 'application/x-mie',
    ['mif'] = 'application/vnd.mif',
    ['mime'] = 'message/rfc822',
    ['mj2'] = 'video/mj2',
    ['mjp2'] = 'video/mj2',
    ['mjs'] = 'text/javascript',
    ['mk3d'] = 'video/x-matroska',
    ['mka'] = 'audio/x-matroska',
    ['mks'] = 'video/x-matroska',
    ['mkv'] = 'video/x-matroska',
    ['mlp'] = 'application/vnd.dolby.mlp',
    ['mmd'] = 'application/vnd.chipnuts.karaoke-mmd',
    ['mmf'] = 'application/vnd.smaf',
    ['mmr'] = 'image/vnd.fujixerox.edmics-mmr',
    ['mng'] = 'video/x-mng',
    ['mny'] = 'application/x-msmoney',
    ['mobi'] = 'application/x-mobipocket-ebook',
    ['mods'] = 'application/mods+xml',
    ['mov'] = 'video/quicktime',
    ['movie'] = 'video/x-sgi-movie',
    ['mp2'] = 'audio/mpeg',
    ['mp21'] = 'application/mp21',
    ['mp2a'] = 'audio/mpeg',
    ['mp3'] = 'audio/mpeg',
    ['mp4'] = 'video/mp4',
    ['mp4a'] = 'audio/mp4',
    ['mp4s'] = 'application/mp4',
    ['mp4v'] = 'video/mp4',
    ['mpc'] = 'application/vnd.mophun.certificate',
    ['mpe'] = 'video/mpeg',
    ['mpeg'] = 'video/mpeg',
    ['mpg'] = 'video/mpeg',
    ['mpg4'] = 'video/mp4',
    ['mpga'] = 'audio/mpeg',
    ['mpkg'] = 'application/vnd.apple.installer+xml',
    ['mpm'] = 'application/vnd.blueice.multipass',
    ['mpn'] = 'application/vnd.mophun.application',
    ['mpp'] = 'application/vnd.ms-project',
    ['mpt'] = 'application/vnd.ms-project',
    ['mpy'] = 'application/vnd.ibm.minipay',
    ['mqy'] = 'application/vnd.mobius.mqy',
    ['mrc'] = 'application/marc',
    ['mrcx'] = 'application/marcxml+xml',
    ['ms'] = 'text/troff',
    ['mscml'] = 'application/mediaservercontrol+xml',
    ['mseed'] = 'application/vnd.fdsn.mseed',
    ['mseq'] = 'application/vnd.mseq',
    ['msf'] = 'application/vnd.epson.msf',
    ['msh'] = 'model/mesh',
    ['msi'] = 'application/x-msdownload',
    ['msl'] = 'application/vnd.mobius.msl',
    ['msty'] = 'application/vnd.muvee.style',
    ['mts'] = 'video/mp2t',
    ['mus'] = 'application/vnd.musician',
    ['musicxml'] = 'application/vnd.recordare.musicxml+xml',
    ['mvb'] = 'application/x-msmediaview',
    ['mwf'] = 'application/vnd.mfer',
    ['mxf'] = 'application/mxf',
    ['mxl'] = 'application/vnd.recordare.musicxml',
    ['mxml'] = 'application/xv+xml',
    ['mxs'] = 'application/vnd.triscape.mxs',
    ['mxu'] = 'video/vnd.mpegurl',
    ['n-gage'] = 'application/vnd.nokia.n-gage.symbian.install',
    ['n3'] = 'text/n3',
    ['nb'] = 'application/mathematica',
    ['nbp'] = 'application/vnd.wolfram.player',
    ['nc'] = 'application/x-netcdf',
    ['ncx'] = 'application/x-dtbncx+xml',
    ['nfo'] = 'text/x-nfo',
    ['ngdat'] = 'application/vnd.nokia.n-gage.data',
    ['nitf'] = 'application/vnd.nitf',
    ['nlu'] = 'application/vnd.neurolanguage.nlu',
    ['nml'] = 'application/vnd.enliven',
    ['nnd'] = 'application/vnd.noblenet-directory',
    ['nns'] = 'application/vnd.noblenet-sealer',
    ['nnw'] = 'application/vnd.noblenet-web',
    ['npx'] = 'image/vnd.net-fpx',
    ['nsc'] = 'application/x-conference',
    ['nsf'] = 'application/vnd.lotus-notes',
    ['ntf'] = 'application/vnd.nitf',
    ['nzb'] = 'application/x-nzb',
    ['oa2'] = 'application/vnd.fujitsu.oasys2',
    ['oa3'] = 'application/vnd.fujitsu.oasys3',
    ['oas'] = 'application/vnd.fujitsu.oasys',
    ['obd'] = 'application/x-msbinder',
    ['obj'] = 'application/x-tgif',
    ['oda'] = 'application/oda',
    ['odb'] = 'application/vnd.oasis.opendocument.database',
    ['odc'] = 'application/vnd.oasis.opendocument.chart',
    ['odf'] = 'application/vnd.oasis.opendocument.formula',
    ['odft'] = 'application/vnd.oasis.opendocument.formula-template',
    ['odg'] = 'application/vnd.oasis.opendocument.graphics',
    ['odi'] = 'application/vnd.oasis.opendocument.image',
    ['odm'] = 'application/vnd.oasis.opendocument.text-master',
    ['odp'] = 'application/vnd.oasis.opendocument.presentation',
    ['ods'] = 'application/vnd.oasis.opendocument.spreadsheet',
    ['odt'] = 'application/vnd.oasis.opendocument.text',
    ['oga'] = 'audio/ogg',
    ['ogg'] = 'audio/ogg',
    ['ogv'] = 'video/ogg',
    ['ogx'] = 'application/ogg',
    ['omdoc'] = 'application/omdoc+xml',
    ['onepkg'] = 'application/onenote',
    ['onetmp'] = 'application/onenote',
    ['onetoc'] = 'application/onenote',
    ['onetoc2'] = 'application/onenote',
    ['opf'] = 'application/oebps-package+xml',
    ['opml'] = 'text/x-opml',
    ['oprc'] = 'application/vnd.palm',
    ['opus'] = 'audio/ogg',
    ['org'] = 'application/vnd.lotus-organizer',
    ['osf'] = 'application/vnd.yamaha.openscoreformat',
    ['osfpvg'] = 'application/vnd.yamaha.openscoreformat.osfpvg+xml',
    ['otc'] = 'application/vnd.oasis.opendocument.chart-template',
    ['otf'] = 'font/otf',
    ['otg'] = 'application/vnd.oasis.opendocument.graphics-template',
    ['oth'] = 'application/vnd.oasis.opendocument.text-web',
    ['oti'] = 'application/vnd.oasis.opendocument.image-template',
    ['otp'] = 'application/vnd.oasis.opendocument.presentation-template',
    ['ots'] = 'application/vnd.oasis.opendocument.spreadsheet-template',
    ['ott'] = 'application/vnd.oasis.opendocument.text-template',
    ['oxps'] = 'application/oxps',
    ['oxt'] = 'application/vnd.openofficeorg.extension',
    ['p'] = 'text/x-pascal',
    ['p10'] = 'application/pkcs10',
    ['p12'] = 'application/x-pkcs12',
    ['p7b'] = 'application/x-pkcs7-certificates',
    ['p7c'] = 'application/pkcs7-mime',
    ['p7m'] = 'application/pkcs7-mime',
    ['p7r'] = 'application/x-pkcs7-certreqresp',
    ['p7s'] = 'application/pkcs7-signature',
    ['p8'] = 'application/pkcs8',
    ['pas'] = 'text/x-pascal',
    ['paw'] = 'application/vnd.pawaafile',
    ['pbd'] = 'application/vnd.powerbuilder6',
    ['pbm'] = 'image/x-portable-bitmap',
    ['pcap'] = 'application/vnd.tcpdump.pcap',
    ['pcf'] = 'application/x-font-pcf',
    ['pcl'] = 'application/vnd.hp-pcl',
    ['pclxl'] = 'application/vnd.hp-pclxl',
    ['pct'] = 'image/x-pict',
    ['pcurl'] = 'application/vnd.curl.pcurl',
    ['pcx'] = 'image/x-pcx',
    ['pdb'] = 'application/vnd.palm',
    ['pdf'] = 'application/pdf',
    ['pfa'] = 'application/x-font-type1',
    ['pfb'] = 'application/x-font-type1',
    ['pfm'] = 'application/x-font-type1',
    ['pfr'] = 'application/font-tdpfr',
    ['pfx'] = 'application/x-pkcs12',
    ['pgm'] = 'image/x-portable-graymap',
    ['pgn'] = 'application/x-chess-pgn',
    ['pgp'] = 'application/pgp-encrypted',
    ['pic'] = 'image/x-pict',
    ['pkg'] = 'application/octet-stream',
    ['pki'] = 'application/pkixcmp',
    ['pkipath'] = 'application/pkix-pkipath',
    ['plb'] = 'application/vnd.3gpp.pic-bw-large',
    ['plc'] = 'application/vnd.mobius.plc',
    ['plf'] = 'application/vnd.pocketlearn',
    ['pls'] = 'application/pls+xml',
    ['pml'] = 'application/vnd.ctc-posml',
    ['png'] = 'image/png',
    ['pnm'] = 'image/x-portable-anymap',
    ['portpkg'] = 'application/vnd.macports.portpkg',
    ['pot'] = 'application/vnd.ms-powerpoint',
    ['potm'] = 'application/vnd.ms-powerpoint.template.macroenabled.12',
    ['potx'] = 'application/vnd.openxmlformats-officedocument.presentationml.template',
    ['ppam'] = 'application/vnd.ms-powerpoint.addin.macroenabled.12',
    ['ppd'] = 'application/vnd.cups-ppd',
    ['ppm'] = 'image/x-portable-pixmap',
    ['pps'] = 'application/vnd.ms-powerpoint',
    ['ppsm'] = 'application/vnd.ms-powerpoint.slideshow.macroenabled.12',
    ['ppsx'] = 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
    ['ppt'] = 'application/vnd.ms-powerpoint',
    ['pptm'] = 'application/vnd.ms-powerpoint.presentation.macroenabled.12',
    ['pptx'] = 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ['pqa'] = 'application/vnd.palm',
    ['prc'] = 'application/x-mobipocket-ebook',
    ['pre'] = 'application/vnd.lotus-freelance',
    ['prf'] = 'application/pics-rules',
    ['ps'] = 'application/postscript',
    ['psb'] = 'application/vnd.3gpp.pic-bw-small',
    ['psd'] = 'image/vnd.adobe.photoshop',
    ['psf'] = 'application/x-font-linux-psf',
    ['pskcxml'] = 'application/pskc+xml',
    ['ptid'] = 'application/vnd.pvi.ptid1',
    ['pub'] = 'application/x-mspublisher',
    ['pvb'] = 'application/vnd.3gpp.pic-bw-var',
    ['pwn'] = 'application/vnd.3m.post-it-notes',
    ['pya'] = 'audio/vnd.ms-playready.media.pya',
    ['pyv'] = 'video/vnd.ms-playready.media.pyv',
    ['qam'] = 'application/vnd.epson.quickanime',
    ['qbo'] = 'application/vnd.intu.qbo',
    ['qfx'] = 'application/vnd.intu.qfx',
    ['qps'] = 'application/vnd.publishare-delta-tree',
    ['qt'] = 'video/quicktime',
    ['qwd'] = 'application/vnd.quark.quarkxpress',
    ['qwt'] = 'application/vnd.quark.quarkxpress',
    ['qxb'] = 'application/vnd.quark.quarkxpress',
    ['qxd'] = 'application/vnd.quark.quarkxpress',
    ['qxl'] = 'application/vnd.quark.quarkxpress',
    ['qxt'] = 'application/vnd.quark.quarkxpress',
    ['ra'] = 'audio/x-pn-realaudio',
    ['ram'] = 'audio/x-pn-realaudio',
    ['rar'] = 'application/x-rar-compressed',
    ['ras'] = 'image/x-cmu-raster',
    ['rcprofile'] = 'application/vnd.ipunplugged.rcprofile',
    ['rdf'] = 'application/rdf+xml',
    ['rdz'] = 'application/vnd.data-vision.rdz',
    ['rep'] = 'application/vnd.businessobjects',
    ['res'] = 'application/x-dtbresource+xml',
    ['rgb'] = 'image/x-rgb',
    ['rif'] = 'application/reginfo+xml',
    ['rip'] = 'audio/vnd.rip',
    ['ris'] = 'application/x-research-info-systems',
    ['rl'] = 'application/resource-lists+xml',
    ['rlc'] = 'image/vnd.fujixerox.edmics-rlc',
    ['rld'] = 'application/resource-lists-diff+xml',
    ['rm'] = 'application/vnd.rn-realmedia',
    ['rmi'] = 'audio/midi',
    ['rmp'] = 'audio/x-pn-realaudio-plugin',
    ['rms'] = 'application/vnd.jcp.javame.midlet-rms',
    ['rmvb'] = 'application/vnd.rn-realmedia-vbr',
    ['rnc'] = 'application/relax-ng-compact-syntax',
    ['roa'] = 'application/rpki-roa',
    ['roff'] = 'text/troff',
    ['rp9'] = 'application/vnd.cloanto.rp9',
    ['rpss'] = 'application/vnd.nokia.radio-presets',
    ['rpst'] = 'application/vnd.nokia.radio-preset',
    ['rq'] = 'application/sparql-query',
    ['rs'] = 'application/rls-services+xml',
    ['rsd'] = 'application/rsd+xml',
    ['rss'] = 'application/rss+xml',
    ['rtf'] = 'application/rtf',
    ['rtx'] = 'text/richtext',
    ['s'] = 'text/x-asm',
    ['s3m'] = 'audio/s3m',
    ['saf'] = 'application/vnd.yamaha.smaf-audio',
    ['sbml'] = 'application/sbml+xml',
    ['sc'] = 'application/vnd.ibm.secure-container',
    ['scd'] = 'application/x-msschedule',
    ['scm'] = 'application/vnd.lotus-screencam',
    ['scq'] = 'application/scvp-cv-request',
    ['scs'] = 'application/scvp-cv-response',
    ['scurl'] = 'text/vnd.curl.scurl',
    ['sda'] = 'application/vnd.stardivision.draw',
    ['sdc'] = 'application/vnd.stardivision.calc',
    ['sdd'] = 'application/vnd.stardivision.impress',
    ['sdkd'] = 'application/vnd.solent.sdkm+xml',
    ['sdkm'] = 'application/vnd.solent.sdkm+xml',
    ['sdp'] = 'application/sdp',
    ['sdw'] = 'application/vnd.stardivision.writer',
    ['see'] = 'application/vnd.seemail',
    ['seed'] = 'application/vnd.fdsn.seed',
    ['sema'] = 'application/vnd.sema',
    ['semd'] = 'application/vnd.semd',
    ['semf'] = 'application/vnd.semf',
    ['ser'] = 'application/java-serialized-object',
    ['setpay'] = 'application/set-payment-initiation',
    ['setreg'] = 'application/set-registration-initiation',
    ['sfd-hdstx'] = 'application/vnd.hydrostatix.sof-data',
    ['sfs'] = 'application/vnd.spotfire.sfs',
    ['sfv'] = 'text/x-sfv',
    ['sgi'] = 'image/sgi',
    ['sgl'] = 'application/vnd.stardivision.writer-global',
    ['sgm'] = 'text/sgml',
    ['sgml'] = 'text/sgml',
    ['sh'] = 'application/x-sh',
    ['shar'] = 'application/x-shar',
    ['shf'] = 'application/shf+xml',
    ['sid'] = 'image/x-mrsid-image',
    ['sig'] = 'application/pgp-signature',
    ['sil'] = 'audio/silk',
    ['silo'] = 'model/mesh',
    ['sis'] = 'application/vnd.symbian.install',
    ['sisx'] = 'application/vnd.symbian.install',
    ['sit'] = 'application/x-stuffit',
    ['sitx'] = 'application/x-stuffitx',
    ['skd'] = 'application/vnd.koan',
    ['skm'] = 'application/vnd.koan',
    ['skp'] = 'application/vnd.koan',
    ['skt'] = 'application/vnd.koan',
    ['sldm'] = 'application/vnd.ms-powerpoint.slide.macroenabled.12',
    ['sldx'] = 'application/vnd.openxmlformats-officedocument.presentationml.slide',
    ['slt'] = 'application/vnd.epson.salt',
    ['sm'] = 'application/vnd.stepmania.stepchart',
    ['smf'] = 'application/vnd.stardivision.math',
    ['smi'] = 'application/smil+xml',
    ['smil'] = 'application/smil+xml',
    ['smv'] = 'video/x-smv',
    ['smzip'] = 'application/vnd.stepmania.package',
    ['snd'] = 'audio/basic',
    ['snf'] = 'application/x-font-snf',
    ['so'] = 'application/octet-stream',
    ['spc'] = 'application/x-pkcs7-certificates',
    ['spf'] = 'application/vnd.yamaha.smaf-phrase',
    ['spl'] = 'application/x-futuresplash',
    ['spot'] = 'text/vnd.in3d.spot',
    ['spp'] = 'application/scvp-vp-response',
    ['spq'] = 'application/scvp-vp-request',
    ['spx'] = 'audio/ogg',
    ['sql'] = 'application/x-sql',
    ['src'] = 'application/x-wais-source',
    ['srt'] = 'application/x-subrip',
    ['sru'] = 'application/sru+xml',
    ['srx'] = 'application/sparql-results+xml',
    ['ssdl'] = 'application/ssdl+xml',
    ['sse'] = 'application/vnd.kodak-descriptor',
    ['ssf'] = 'application/vnd.epson.ssf',
    ['ssml'] = 'application/ssml+xml',
    ['st'] = 'application/vnd.sailingtracker.track',
    ['stc'] = 'application/vnd.sun.xml.calc.template',
    ['std'] = 'application/vnd.sun.xml.draw.template',
    ['stf'] = 'application/vnd.wt.stf',
    ['sti'] = 'application/vnd.sun.xml.impress.template',
    ['stk'] = 'application/hyperstudio',
    ['stl'] = 'application/vnd.ms-pki.stl',
    ['str'] = 'application/vnd.pg.format',
    ['stw'] = 'application/vnd.sun.xml.writer.template',
    ['sub'] = 'text/vnd.dvb.subtitle',
    ['sus'] = 'application/vnd.sus-calendar',
    ['susp'] = 'application/vnd.sus-calendar',
    ['sv4cpio'] = 'application/x-sv4cpio',
    ['sv4crc'] = 'application/x-sv4crc',
    ['svc'] = 'application/vnd.dvb.service',
    ['svd'] = 'application/vnd.svd',
    ['svg'] = 'image/svg+xml',
    ['svgz'] = 'image/svg+xml',
    ['swa'] = 'application/x-director',
    ['swf'] = 'application/x-shockwave-flash',
    ['swi'] = 'application/vnd.aristanetworks.swi',
    ['sxc'] = 'application/vnd.sun.xml.calc',
    ['sxd'] = 'application/vnd.sun.xml.draw',
    ['sxg'] = 'application/vnd.sun.xml.writer.global',
    ['sxi'] = 'application/vnd.sun.xml.impress',
    ['sxm'] = 'application/vnd.sun.xml.math',
    ['sxw'] = 'application/vnd.sun.xml.writer',
    ['t'] = 'text/troff',
    ['t3'] = 'application/x-t3vm-image',
    ['taglet'] = 'application/vnd.mynfc',
    ['tao'] = 'application/vnd.tao.intent-module-archive',
    ['tar'] = 'application/x-tar',
    ['tcap'] = 'application/vnd.3gpp2.tcap',
    ['tcl'] = 'application/x-tcl',
    ['teacher'] = 'application/vnd.smart.teacher',
    ['tei'] = 'application/tei+xml',
    ['teicorpus'] = 'application/tei+xml',
    ['tex'] = 'application/x-tex',
    ['texi'] = 'application/x-texinfo',
    ['texinfo'] = 'application/x-texinfo',
    ['text'] = 'text/plain',
    ['tfi'] = 'application/thraud+xml',
    ['tfm'] = 'application/x-tex-tfm',
    ['tga'] = 'image/x-tga',
    ['thmx'] = 'application/vnd.ms-officetheme',
    ['tif'] = 'image/tiff',
    ['tiff'] = 'image/tiff',
    ['tmo'] = 'application/vnd.tmobile-livetv',
    ['torrent'] = 'application/x-bittorrent',
    ['tpl'] = 'application/vnd.groove-tool-template',
    ['tpt'] = 'application/vnd.trid.tpt',
    ['tr'] = 'text/troff',
    ['tra'] = 'application/vnd.trueapp',
    ['trm'] = 'application/x-msterminal',
    ['ts'] = 'video/mp2t',
    ['tsd'] = 'application/timestamped-data',
    ['tsv'] = 'text/tab-separated-values',
    ['ttc'] = 'font/collection',
    ['ttf'] = 'font/ttf',
    ['ttl'] = 'text/turtle',
    ['twd'] = 'application/vnd.simtech-mindmapper',
    ['twds'] = 'application/vnd.simtech-mindmapper',
    ['txd'] = 'application/vnd.genomatix.tuxedo',
    ['txf'] = 'application/vnd.mobius.txf',
    ['txt'] = 'text/plain',
    ['u32'] = 'application/x-authorware-bin',
    ['udeb'] = 'application/x-debian-package',
    ['ufd'] = 'application/vnd.ufdl',
    ['ufdl'] = 'application/vnd.ufdl',
    ['ulx'] = 'application/x-glulx',
    ['umj'] = 'application/vnd.umajin',
    ['unityweb'] = 'application/vnd.unity',
    ['uoml'] = 'application/vnd.uoml+xml',
    ['uri'] = 'text/uri-list',
    ['uris'] = 'text/uri-list',
    ['urls'] = 'text/uri-list',
    ['ustar'] = 'application/x-ustar',
    ['utz'] = 'application/vnd.uiq.theme',
    ['uu'] = 'text/x-uuencode',
    ['uva'] = 'audio/vnd.dece.audio',
    ['uvd'] = 'application/vnd.dece.data',
    ['uvf'] = 'application/vnd.dece.data',
    ['uvg'] = 'image/vnd.dece.graphic',
    ['uvh'] = 'video/vnd.dece.hd',
    ['uvi'] = 'image/vnd.dece.graphic',
    ['uvm'] = 'video/vnd.dece.mobile',
    ['uvp'] = 'video/vnd.dece.pd',
    ['uvs'] = 'video/vnd.dece.sd',
    ['uvt'] = 'application/vnd.dece.ttml+xml',
    ['uvu'] = 'video/vnd.uvvu.mp4',
    ['uvv'] = 'video/vnd.dece.video',
    ['uvva'] = 'audio/vnd.dece.audio',
    ['uvvd'] = 'application/vnd.dece.data',
    ['uvvf'] = 'application/vnd.dece.data',
    ['uvvg'] = 'image/vnd.dece.graphic',
    ['uvvh'] = 'video/vnd.dece.hd',
    ['uvvi'] = 'image/vnd.dece.graphic',
    ['uvvm'] = 'video/vnd.dece.mobile',
    ['uvvp'] = 'video/vnd.dece.pd',
    ['uvvs'] = 'video/vnd.dece.sd',
    ['uvvt'] = 'application/vnd.dece.ttml+xml',
    ['uvvu'] = 'video/vnd.uvvu.mp4',
    ['uvvv'] = 'video/vnd.dece.video',
    ['uvvx'] = 'application/vnd.dece.unspecified',
    ['uvvz'] = 'application/vnd.dece.zip',
    ['uvx'] = 'application/vnd.dece.unspecified',
    ['uvz'] = 'application/vnd.dece.zip',
    ['vcard'] = 'text/vcard',
    ['vcd'] = 'application/x-cdlink',
    ['vcf'] = 'text/x-vcard',
    ['vcg'] = 'application/vnd.groove-vcard',
    ['vcs'] = 'text/x-vcalendar',
    ['vcx'] = 'application/vnd.vcx',
    ['vis'] = 'application/vnd.visionary',
    ['viv'] = 'video/vnd.vivo',
    ['vob'] = 'video/x-ms-vob',
    ['vor'] = 'application/vnd.stardivision.writer',
    ['vox'] = 'application/x-authorware-bin',
    ['vrml'] = 'model/vrml',
    ['vsd'] = 'application/vnd.visio',
    ['vsf'] = 'application/vnd.vsf',
    ['vss'] = 'application/vnd.visio',
    ['vst'] = 'application/vnd.visio',
    ['vsw'] = 'application/vnd.visio',
    ['vtu'] = 'model/vnd.vtu',
    ['vxml'] = 'application/voicexml+xml',
    ['w3d'] = 'application/x-director',
    ['wad'] = 'application/x-doom',
    ['wasm'] = 'application/wasm',
    ['wav'] = 'audio/x-wav',
    ['wax'] = 'audio/x-ms-wax',
    ['wbmp'] = 'image/vnd.wap.wbmp',
    ['wbs'] = 'application/vnd.criticaltools.wbs+xml',
    ['wbxml'] = 'application/vnd.wap.wbxml',
    ['wcm'] = 'application/vnd.ms-works',
    ['wdb'] = 'application/vnd.ms-works',
    ['wdp'] = 'image/vnd.ms-photo',
    ['weba'] = 'audio/webm',
    ['webm'] = 'video/webm',
    ['webp'] = 'image/webp',
    ['wg'] = 'application/vnd.pmi.widget',
    ['wgt'] = 'application/widget',
    ['wks'] = 'application/vnd.ms-works',
    ['wm'] = 'video/x-ms-wm',
    ['wma'] = 'audio/x-ms-wma',
    ['wmd'] = 'application/x-ms-wmd',
    ['wmf'] = 'application/x-msmetafile',
    ['wml'] = 'text/vnd.wap.wml',
    ['wmlc'] = 'application/vnd.wap.wmlc',
    ['wmls'] = 'text/vnd.wap.wmlscript',
    ['wmlsc'] = 'application/vnd.wap.wmlscriptc',
    ['wmv'] = 'video/x-ms-wmv',
    ['wmx'] = 'video/x-ms-wmx',
    ['wmz'] = 'application/x-ms-wmz',
    ['woff'] = 'font/woff',
    ['woff2'] = 'font/woff2',
    ['wpd'] = 'application/vnd.wordperfect',
    ['wpl'] = 'application/vnd.ms-wpl',
    ['wps'] = 'application/vnd.ms-works',
    ['wqd'] = 'application/vnd.wqd',
    ['wri'] = 'application/x-mswrite',
    ['wrl'] = 'model/vrml',
    ['wsdl'] = 'application/wsdl+xml',
    ['wspolicy'] = 'application/wspolicy+xml',
    ['wtb'] = 'application/vnd.webturbo',
    ['wvx'] = 'video/x-ms-wvx',
    ['x32'] = 'application/x-authorware-bin',
    ['x3d'] = 'model/x3d+xml',
    ['x3db'] = 'model/x3d+binary',
    ['x3dbz'] = 'model/x3d+binary',
    ['x3dv'] = 'model/x3d+vrml',
    ['x3dvz'] = 'model/x3d+vrml',
    ['x3dz'] = 'model/x3d+xml',
    ['xaml'] = 'application/xaml+xml',
    ['xap'] = 'application/x-silverlight-app',
    ['xar'] = 'application/vnd.xara',
    ['xbap'] = 'application/x-ms-xbap',
    ['xbd'] = 'application/vnd.fujixerox.docuworks.binder',
    ['xbm'] = 'image/x-xbitmap',
    ['xdf'] = 'application/xcap-diff+xml',
    ['xdm'] = 'application/vnd.syncml.dm+xml',
    ['xdp'] = 'application/vnd.adobe.xdp+xml',
    ['xdssc'] = 'application/dssc+xml',
    ['xdw'] = 'application/vnd.fujixerox.docuworks',
    ['xenc'] = 'application/xenc+xml',
    ['xer'] = 'application/patch-ops-error+xml',
    ['xfdf'] = 'application/vnd.adobe.xfdf',
    ['xfdl'] = 'application/vnd.xfdl',
    ['xht'] = 'application/xhtml+xml',
    ['xhtml'] = 'application/xhtml+xml',
    ['xhvml'] = 'application/xv+xml',
    ['xif'] = 'image/vnd.xiff',
    ['xla'] = 'application/vnd.ms-excel',
    ['xlam'] = 'application/vnd.ms-excel.addin.macroenabled.12',
    ['xlc'] = 'application/vnd.ms-excel',
    ['xlf'] = 'application/x-xliff+xml',
    ['xlm'] = 'application/vnd.ms-excel',
    ['xls'] = 'application/vnd.ms-excel',
    ['xlsb'] = 'application/vnd.ms-excel.sheet.binary.macroenabled.12',
    ['xlsm'] = 'application/vnd.ms-excel.sheet.macroenabled.12',
    ['xlsx'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ['xlt'] = 'application/vnd.ms-excel',
    ['xltm'] = 'application/vnd.ms-excel.template.macroenabled.12',
    ['xltx'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
    ['xlw'] = 'application/vnd.ms-excel',
    ['xm'] = 'audio/xm',
    ['xml'] = 'application/xml',
    ['xo'] = 'application/vnd.olpc-sugar',
    ['xop'] = 'application/xop+xml',
    ['xpi'] = 'application/x-xpinstall',
    ['xpl'] = 'application/xproc+xml',
    ['xpm'] = 'image/x-xpixmap',
    ['xpr'] = 'application/vnd.is-xpr',
    ['xps'] = 'application/vnd.ms-xpsdocument',
    ['xpw'] = 'application/vnd.intercon.formnet',
    ['xpx'] = 'application/vnd.intercon.formnet',
    ['xsl'] = 'application/xml',
    ['xslt'] = 'application/xslt+xml',
    ['xsm'] = 'application/vnd.syncml+xml',
    ['xspf'] = 'application/xspf+xml',
    ['xul'] = 'application/vnd.mozilla.xul+xml',
    ['xvm'] = 'application/xv+xml',
    ['xvml'] = 'application/xv+xml',
    ['xwd'] = 'image/x-xwindowdump',
    ['xyz'] = 'chemical/x-xyz',
    ['xz'] = 'application/x-xz',
    ['yang'] = 'application/yang',
    ['yin'] = 'application/yin+xml',
    ['z1'] = 'application/x-zmachine',
    ['z2'] = 'application/x-zmachine',
    ['z3'] = 'application/x-zmachine',
    ['z4'] = 'application/x-zmachine',
    ['z5'] = 'application/x-zmachine',
    ['z6'] = 'application/x-zmachine',
    ['z7'] = 'application/x-zmachine',
    ['z8'] = 'application/x-zmachine',
    ['zaz'] = 'application/vnd.zzazz.deck+xml',
    ['zip'] = 'application/zip',
    ['zir'] = 'application/vnd.zul',
    ['zirz'] = 'application/vnd.zul',
    ['zmm'] = 'application/vnd.handheld-entertainment+xml'
  };

  local Server = {
    _server = TcpSocketServer.New(),
    _routes = {},
    _middleware = {},
    _dataCoroutines = {},
    _wsMessageHandlers = {}  -- Store WebSocket message handlers by socket
  }

  local function respond(sock, code, body, options)
    options = options or {};

    if(body == nil) then
      -- do nothing
    elseif(type(body) == 'table') then
      body = require('rapidjson').encode(body);
    elseif(type(body) ~= 'string') then
      body = tostring(body);
    end;

    local headers = options.headers or {};
    local headerString = '';

    if(not headers.Connection) then
      headerString = headerString .. 'Connection: close\r\n';
    else
      options.keepalive = true;
    end;

    -- Use chunked encoding if explicitly requested
    if(options.chunked) then
      headerString = headerString .. 'Transfer-Encoding: chunked\r\n';
    elseif(body ~= nil) then
      headerString = headerString .. ('Content-Length: %d\r\n'):format(#body);
    end;

    for k,v in pairs(options.headers or {}) do
      headerString = headerString .. ("%s: %s\r\n"):format(k,v);
    end;

    sock:Write(
      ('HTTP/1.1 %d %s\r\n%s\r\n%s'):format(
        code, HTTP_CODES[code], headerString, (body ~= nil) and body or ''
      )
    )
    if(not options.keepalive) then Timer.CallAfter(function() sock:Disconnect(); end, 1); end; -- workaround for non-blocking write
  end;

  local function sendChunk(sock, data)
    if(data and #data > 0) then
      sock:Write(string.format('%X\r\n', #data) .. data .. '\r\n');
    end;
  end;

  local function endChunked(sock)
    sock:Write('0\r\n\r\n');
    Timer.CallAfter(function() sock:Disconnect(); end, 1);
  end;

  local function defaultHandler(req, res)
    res.sendStatus(404);
  end;

  local HttpResponse = {
    New = function(obj)
      return setmetatable({
        socket = obj.socket,
        headers = {},
        statusCode = obj.statusCode or 200,
        _headersSent = false,
        _chunked = false
      },{
        __index = function(t,k)
          if(k == 'status') then
            return function(code)
              t.statusCode = code;
              return t;
            end
          elseif(k == 'send') then
            return function(body)
              respond(t.socket, t.statusCode, body, {headers = t.headers});
              t._headersSent = true;
              return t;
            end
          elseif(k == 'set') then
            return function(k,v)
              t.headers[k] = v;
              return t;
            end
          elseif(k == 'get') then
            return function(k)
              return t.headers[k];
            end
          elseif(k == 'sendStatus') then
            return function(code)
              t.status(code);
              t.send(HTTP_CODES[code]);
              return t;
            end;
          elseif(k == 'writeHead') then
            return function(code)
              if(t._headersSent) then
                error('Headers already sent');
              end;
              code = code or t.statusCode;
              respond(t.socket, code, nil, {headers = t.headers, chunked = t._chunked});
              t._headersSent = true;
              return t;
            end;
          elseif(k == 'write') then
            return function(data)
              if(not t._headersSent) then
                t._chunked = true;
                t.writeHead();
              end;
              sendChunk(t.socket, data);
              return t;
            end;
          elseif(k == 'end') then
            return function(data)
              if(data) then
                t.write(data);
              end;
              if(t._chunked) then
                endChunked(t.socket);
              elseif(not t._headersSent) then
                t.send('');
              end;
              return t;
            end;
          end
        end
      })
    end
  }

  local HttpRequest = {
    New = function(obj)
      return setmetatable(obj, {
        
      })
    end;
  }

  local WebSocket = {
    New = function(req, res, callback, server)

      if(not(req.headers['upgrade'] and req.headers['upgrade'][1] == 'websocket')) then
        res.sendStatus(400);
        return;
      end;

      if(not(req.headers['sec-websocket-version'] and req.headers['sec-websocket-version'][1])) then
        res.sendStatus(400);
        return;
      end;

      if(not(req.headers['sec-websocket-key'] and req.headers['sec-websocket-key'][1] ~= '')) then
        res.sendStatus(400);
        return;
      end;

      local client_key = req.headers['sec-websocket-key'][1];
      local response_key = Crypto.Digest('sha1', client_key .. "258EAFA5-E914-47DA-95CA-C5AB0DC85B11");
      local response_b64 = Crypto.Base64Encode(response_key);

      print('WEBSOCKET (v' .. req.headers['sec-websocket-version'][1] .. ')');

      res.headers['Upgrade'] = 'websocket';
      res.headers['Connection'] = 'Upgrade';
      res.headers['Sec-WebSocket-Accept'] = response_b64;
      res.status(101).send()
      
      local socket = rawget(res, 'socket');

      -- WebSocket frame parser
      local function parseWebSocketFrame()
        if socket.BufferLength < 2 then
          return nil -- Need at least 2 bytes for header
        end

        -- Read first 2 bytes to get frame info
        local header = socket:Read(2)
        if not header or #header < 2 then
          return nil
        end

        local byte1 = string.byte(header, 1)
        local byte2 = string.byte(header, 2)

        -- Use bitstring library for bit operations (Q-SYS compatible)
        local fin = (byte1 >= 0x80)
        local opcode = byte1 % 16
        local masked = (byte2 >= 0x80)
        local payloadLen = byte2 % 128

        -- Read extended payload length if needed
        if payloadLen == 126 then
          if socket.BufferLength < 2 then return nil end
          local lenBytes = socket:Read(2)
          payloadLen = string.byte(lenBytes, 1) * 256 + string.byte(lenBytes, 2)
        elseif payloadLen == 127 then
          if socket.BufferLength < 8 then return nil end
          local lenBytes = socket:Read(8)
          -- For simplicity, just read lower 4 bytes (max ~4GB)
          payloadLen = string.byte(lenBytes, 5) * 16777216 +
                       string.byte(lenBytes, 6) * 65536 +
                       string.byte(lenBytes, 7) * 256 +
                       string.byte(lenBytes, 8)
        end

        -- Read mask key if present
        local maskKey = nil
        if masked then
          if socket.BufferLength < 4 then return nil end
          maskKey = socket:Read(4)
        end

        -- Read payload
        if socket.BufferLength < payloadLen then return nil end
        local payload = socket:Read(payloadLen)

        -- Unmask payload if needed (XOR operation)
        if masked and maskKey then
          local unmasked = {}
          for i = 1, #payload do
            local maskByte = string.byte(maskKey, ((i - 1) % 4) + 1)
            local payloadByte = string.byte(payload, i)

            -- Manual XOR implementation (Q-SYS Lua compatible)
            local xor_value = 0
            local bit = 1
            for j = 0, 7 do
              local mask_bit = (maskByte % 2 == 1)
              local payload_bit = (payloadByte % 2 == 1)
              if mask_bit ~= payload_bit then
                xor_value = xor_value + bit
              end
              maskByte = math.floor(maskByte / 2)
              payloadByte = math.floor(payloadByte / 2)
              bit = bit * 2
            end

            unmasked[i] = string.char(xor_value)
          end
          payload = table.concat(unmasked)
        end

        return {
          opcode = opcode,
          payload = payload,
          fin = fin
        }
      end

      socket.Data = function()
        -- Try to parse incoming WebSocket frames
        while socket.BufferLength > 0 do
          local frame = parseWebSocketFrame()
          if not frame then
            break -- Need more data
          end

          -- Handle frame based on opcode
          if frame.opcode == 0x01 then -- Text frame
            -- Trigger callback if set in handlers table
            if server and server._wsMessageHandlers and server._wsMessageHandlers[socket] then
              server._wsMessageHandlers[socket](socket, frame.payload)
            end
          elseif frame.opcode == 0x08 then -- Close frame
            -- Clean up handler
            if server and server._wsMessageHandlers then
              server._wsMessageHandlers[socket] = nil
            end
            socket:Disconnect()
            break
          elseif frame.opcode == 0x09 then -- Ping frame
            -- Send pong response
            local pongFrame = string.char(0x8A, 0x00) -- FIN + Pong opcode, 0 payload
            socket:Write(pongFrame)
          end
          -- Ignore other opcodes (binary, pong, etc.)
        end
      end;

      local function frameData(data)

        local header_len = #data;
        local len_suffix = '';
        if(header_len > 65535) then
          header_len = 127;
          len_suffix = string.pack('>I8', #data); 
        elseif(header_len > 125) then
          header_len = 126;
          len_suffix = string.pack('>I2', #data);
        end; 

        local packet = bitstring.pack('1:int 3:int 4:int 1:int 7:int', 1, 0, 0x01, 0, header_len) .. len_suffix;

        packet = packet .. data;
        return packet;
      end;

      local wsObject = setmetatable({socket = socket, server = server}, {
        __newindex = function(t,k,v)
          if(k == 'Closed') then
            if(type(v) ~= 'function') then
              error('Property "Closed" expects function, ' .. type(v) .. ' was given.');
            end;
            socket.Closed = v;
          elseif(k == 'socket') then
            rawset(t, k, v);
          end;
        end,
        __index = function(t,k)
          if(k == 'Write') then
            return function(self,str)
              if(type(str) == 'table') then str = require('rapidjson').encode(str); end;
              if(type(str) ~= 'string') then str = tostring(str); end;
              socket:Write(frameData(str));
            end
          elseif(k == 'IsConnected') then
            return socket.IsConnected;
          elseif(k == 'socket') then
            return rawget(t, 'socket');
          else
            error('Property "' .. k .. ' does not exist on WebSocket.');
          end;
        end
      });

      callback(wsObject);

    end
  }

  local function dataHandler(Sock)

    local function read()
      while(Sock:Search('\r\n') == 1) do Sock:Read(2); end;
      return Sock:ReadLine(TcpSocket.EOL.Custom, '\r\n\r\n');
    end;
    for line in read do
      local verb, resource, proto, headerString = line:match('^(%u+) ([^ ]+) HTTP/(%d%.%d)\r\n(.*)');

      -- Parse headers
      local headers = {};
      while(#headerString > 0) do

        local k,v;
        k,v,headerString = headerString:match('^([^:]+):[\t ]?([^\r\n]+)(.*)');
        if(not k) then return respond(Sock, 400); end;

        if(headerString:sub(1,2) == '\r\n') then headerString = headerString:sub(3); end;

        k = k:lower();
        if(headers[k]) then
          table.insert(headers[k], v);
        else
          headers[k] = {v};
        end;

      end;

      -- Host header must be present for HTTP 1.1
      if(proto == '1.1' and not headers['host']) then
        respond(Sock, 400);
      end;

      -- Host header must only be present once for HTTP 1.1
      if(proto == '1.1' and #headers['host'] ~= 1) then
        respond(Sock, 400);
      end;

      -- Apply host header if resource is not HTTP URI
      local host = resource:match('^http://([^/]+)');
      if(not host) then host = headers['host'][1]; end;

      -- Check for transfer encoding
      if(headers['transfer-encoding']) then
        Sock:Disconnect();
        -- TODO: implement transfer-encoding
        error('TODO: implement transfer-encoding.');
      end;

      -- Check for request body
      local body = '';
      if(headers['content-length']) then
        local expectedBodyLength = tonumber(headers['content-length'][1]);
        if(not expectedBodyLength) then return respond(Sock, 400); end;

        while(#body < expectedBodyLength) do
          local remainingBytes = expectedBodyLength - #body;
          local chunk = Sock:Read(remainingBytes);
          if(chunk and #chunk > 0) then
            body = body .. chunk;
          else
            coroutine.yield();
          end;
        end;

      end;

      local request = HttpRequest.New({
        method = verb,
        path = resource:match('^([^?]+)'),
        query = resource:match('%?(.+)$'),
        headers = headers,
        body = body
      });

      local response = HttpResponse.New({
        socket = Sock
      });

      for _,middleware in ipairs(Server._middleware) do
        if(request.path:match('^' .. middleware.path)) then
          local handled = middleware.fn(request, response);
          if(handled) then return; end;
        end;
      end;

      -- print(verb, host, resource, proto, (body and #body), require('rapidjson').encode(headers));

      for fn, handler in pairs(Server._routes) do
        local params = fn(request);
        if(params) then 
          request.params = params;
          local ok, err = pcall(handler, request, response);
          if(not ok) then
            response.status(500).send(err);
            print('SERVER ERROR: ' .. err);
          end;
          return;
        end;
      end;

      defaultHandler(request, response);

    end;

  end;

  Server._server.EventHandler = function(Sock)

    print('CONNECTION'); 
    Sock.EventHandler = print;

    Sock.Data = function()

      local function setupCoroutine()
        Server._dataCoroutines[Sock] = coroutine.create(dataHandler);
      end;

      if(not Server._dataCoroutines[Sock]) then
        setupCoroutine();
      elseif(coroutine.status(Server._dataCoroutines[Sock]) == "dead") then
        setupCoroutine();
      end

      local ok, err = coroutine.resume(Server._dataCoroutines[Sock], Sock);
      if(not ok) then error(err); end; 

    end;

  end;

  local function contains(t, v)
    for _,c in pairs(t) do
      if(c == v) then return true; end;
    end;
    return false;
  end;

  local function addRoute(server, route, verb, handler)
    local matchFn = function(req)

      -- Match method
      if(verb ~= 'all'
        and req.method:lower() ~= verb
        and req.method:upper() ~= 'OPTIONS'
      ) then return; end;

      -- Match parameters
      local paramNames = {};

      local matchPattern = route;
      
      -- escape special characters
      matchPattern = matchPattern:gsub('([%%%*%+%-%?])', function(char) return '%'..char; end);

      -- insert match patterns
      matchPattern = matchPattern:gsub('/:([^/+]+)', function(paramName)
        table.insert(paramNames, paramName);
        return '/([^/+]+)'
      end);

      matchPattern = '^'..matchPattern..'/?$'; -- match whole string

      local values = {req.path:match(matchPattern)};
      if(not values[1]) then return; end;
      local params = {};
      for i,k in ipairs(paramNames) do
        params[k] = values[i];
      end;

      if(req.method:upper() == 'OPTIONS') then
        return verb:upper();
      else
        return params;
      end;

    end;
    server._routes[matchFn] = handler;
  end;

  local function addMiddleware(path, fn)
    assert(type(path) == 'string', 'Middleware path must be a string.');
    assert(type(fn) == 'function', 'Middleware function must be a function.');
    table.insert(Server._middleware, {path = path, fn = fn});
  end;

  return {
    STATUS_CODE = HTTP_CODES,
    METHOD = HTTP_METHODS,
    New = function()
      return setmetatable(Server, {
        __index = function(t, k)

          -- New route for HTTP verb
          if(k:lower() == k and contains(HTTP_METHODS, k:upper())) then
            return function(server, route, handler)
              addRoute(server, route, k, handler);
            end;
          end;

          -- New route for any HTTP verb
          if(k == 'all') then
            return function(server, route, handler)
              addRoute(server, route, 'all', handler);
            end;
          end;

          if(k == 'listen') then
            return function(server, port)
              server._server:Listen(port);
            end;
          end;

          if(k == 'ws') then
            return function(server, route, handler)
              if(type(handler) ~= 'function') then
                error('Expected "function" argument, got ' .. type(handler));
              end;
              addRoute(server, route, 'get', function(req, res)
                WebSocket.New(req, res, handler, server);
              end)
            end;
          end;

          if(k == 'use') then
            return function(server, ...)
              local args = {...};
              if(#args == 1) then
                addMiddleware('/', args[1]);
              else
                addMiddleware(args[1], args[2]);
              end;
            end;
          end;

        end;
      })
    end,
    json = function()
      return function(req, res)
        if(req.headers['content-type'] and req.headers['content-type'][1] == 'application/json') then
          req.body = require('rapidjson').decode(req.body);
        end;
      end;
    end,
    cors = function(config)
      config = config or {};

      config.default_methods = config.default_methods
        or {'GET','HEAD','PUT','PATCH','POST','DELETE'};

      config.default_headers = config.default_headers or {'*'};

      return function(req, res)

        res.set('Access-Control-Allow-Origin', '*');
        res.set(
          'Access-Control-Allow-Headers',
          table.concat(config.default_headers, ', ')
        );
        if(req.method:upper() ~= 'OPTIONS') then
          return;
        end;

        local methods = {};
        for fn in pairs(Server._routes) do
          local method = fn(req);
          if(method and method ~= 'all') then
            if(not contains(methods, method)) then
              table.insert(methods, method);
            end;
          end;
        end;
        
        if(#methods > 0) then
          res.set('Access-Control-Allow-Methods', 'OPTIONS, ' .. table.concat(methods, ', '));
        else
          res.set('Access-Control-Allow-Methods', table.concat(config.default_methods, ', '));
        end; 

        res.sendStatus(204);
        return true; 

      end;
    end,
    Static = function(root, options)
      if(root:match('^/')) then root = root:sub(2); end;
      options = options or {};
      local chunkSize = options.chunkSize or 8192; -- 8KB default chunk size
      local maxBufferSize = options.maxBufferSize or 65536; -- 64KB threshold for automatic chunking
      local useChunkedTransfer = options.chunked; -- nil = auto-detect, true = force chunked, false = force buffered

      return function(req, res)
        local fh = io.open(root .. req.path, 'r');
        if(not fh) then return; end;

        -- Set MIME type based on file extension
        if not res.get('Content-Type') then
          local extension = req.path:match("^.+%.(.+)$")
          if MIME_HEADERS[extension] then res.set('Content-Type', MIME_HEADERS[extension]); end
        end;

        -- Auto-detect file size and determine chunking strategy if not explicitly set
        local shouldUseChunked = useChunkedTransfer;
        if(shouldUseChunked == nil) then
          local currentPos = fh:seek(); -- Save current position
          local fileSize = fh:seek('end'); -- Get file size
          fh:seek('set', currentPos); -- Restore position
          shouldUseChunked = fileSize > maxBufferSize;
        end;

        -- For chunked transfer, stream the file
        if(shouldUseChunked) then
          -- Set chunked flag and send headers BEFORE writing data
          res._chunked = true;
          res.writeHead();

          local chunk = fh:read(chunkSize);
          while(chunk) do
            res.write(chunk);
            chunk = fh:read(chunkSize);
          end;
          fh:close();
          res['end']();
        else
          -- For non-chunked transfer, read entire file
          local data = fh:read('*all');
          fh:close();
          res.send(data);
        end;

        return true; -- handled
      end;
    end
  };

end)();
--------------------- 'qsys-http-server' --------------------- 
--require 'qsys-http-server'

json = require 'rapidjson'

-- Create HTTP server0
local server = HttpServer.New()

-- Middleware
server:use(HttpServer.cors())
server:use(HttpServer.json())

-- Serve static files from dist directory
--server:use('/', HttpServer.Static('dist/q-sys-angular-components'))
function UpdateDirectory() 
  server:use(HttpServer.Static((System.IsEmulating and 'design' or 'media')..'/'..Controls['root-directory'].String)) 
end
UpdateDirectory()
Controls['root-directory'].EventHandler = UpdateDirectory

-- ========== Control Handler Re-initialization ==========
-- Function to safely re-establish control handlers after QRWC reconnection
local function ReinitializeControlHandlers()
  print("Re-initializing control handlers after QRWC reconnection...")
  
  -- Re-establish root-directory handler
  if Controls['root-directory'] then
    Controls['root-directory'].EventHandler = UpdateDirectory
    print("✓ Re-established root-directory EventHandler")
  end
  
  -- Re-establish port handler
  if Controls.port then
    Controls.port.EventHandler = Listen
    print("✓ Re-established port EventHandler")
  end
  
  -- Re-establish trigger handler
  if Controls.trigger_update then
    Controls.trigger_update.EventHandler = function()
      local jsonStr = GenerateSecureDiscoveryJson()
      WriteJsonToControl(jsonStr)
    end
    print("✓ Re-established trigger_update EventHandler")
  end
end

-- ========== Module-level Timer Management ==========
-- Create timers at module scope to avoid lifecycle issues
-- These will be reused for different discovery and subscription operations
local discoveryTimer = nil
local subscriptionThrottleTimers = {}  -- Per-subscription throttle timers
local reconnectionCheckTimer = nil
local lastQRWCConnectionState = nil  -- Track QRWC connection state to detect transitions

-- ========== WebSocket endpoint for component discovery ==========
server:ws('/ws/discovery', function(ws)
  print('WebSocket client connected to /ws/discovery')

  -- Function to discover all components and controls (asynchronously)
  local function discoverComponentsAsync()
    local components = Component.GetComponents()
    local discoveryData = {
      timestamp = os.date("%Y-%m-%dT%H:%M:%S"),
      totalComponents = #components,
      components = {}
    }

    print("Starting component discovery via WebSocket...")
    print("Found " .. #components .. " components")

    local currentIndex = 1
    local batchSize = 5  -- Process 5 components at a time to avoid timeout

    -- Process components in batches using the module-level timer
    if discoveryTimer then
      discoveryTimer:Stop()
    end
    discoveryTimer = Timer.New()
    discoveryTimer.EventHandler = function()
      local batchEnd = math.min(currentIndex + batchSize - 1, #components)

      print(string.format("Processing components %d-%d of %d", currentIndex, batchEnd, #components))

      -- Process this batch of components
      for i = currentIndex, batchEnd do
        local comp = components[i]
        local componentData = {
          name = comp.Name,
          type = comp.Type,
          properties = comp.Properties or {},
          controls = {}
        }

        -- Get all controls for this component
        local success, controls = pcall(function()
          return Component.GetControls(comp.Name)
        end)

        if success and controls then
          componentData.controlCount = #controls

          -- Note: We don't fetch Choices in WebSocket discovery to avoid errors
          -- Choices will be fetched via HTTP API when a specific component is selected

          -- Iterate through each control
          for _, ctrl in ipairs(controls) do
            table.insert(componentData.controls, {
              name = ctrl.Name,
              type = ctrl.Type or "Text",
              direction = ctrl.Direction or "Read/Write",
              value = type(ctrl.Value) == "number" and ctrl.Value or nil,
              valueMin = type(ctrl.ValueMin) == "number" and ctrl.ValueMin or nil,
              valueMax = type(ctrl.ValueMax) == "number" and ctrl.ValueMax or nil,
              position = type(ctrl.Position) == "number" and ctrl.Position or nil,
              string = type(ctrl.String) == "string" and ctrl.String or "",
              choices = nil  -- Choices will be fetched via HTTP when component is selected
            })
          end
        else
          componentData.controlCount = 0
          componentData.error = "Failed to get controls"
        end

        table.insert(discoveryData.components, componentData)
      end

      currentIndex = batchEnd + 1

      -- Check if we're done
      if currentIndex > #components then
        -- Stop timer
        discoveryTimer:Stop()

        -- Encode as JSON
        local jsonOutput = json.encode(discoveryData, { pretty = false })

        print("Component Discovery Complete - sending " .. #jsonOutput .. " bytes via WebSocket")

        -- Send via WebSocket (the library handles large payloads)
        if ws.IsConnected then
          ws:Write({
            type = "discovery",
            data = discoveryData
          })
        else
          print("WebSocket disconnected before discovery completed")
        end
      end
    end

    -- Start processing with a small delay
    discoveryTimer:Start(0.1)
  end

  -- Start async discovery
  discoverComponentsAsync()

  -- Handle client disconnection
  ws.Closed = function()
    print('WebSocket client disconnected from /ws/discovery')
  end
end)

-- Track active WebSocket connections for component updates
local activeUpdateConnections = {}

-- WebSocket endpoint for real-time component updates
server:ws('/ws/updates', function(ws)
  print('WebSocket client connected to /ws/updates')

  -- Add this connection to active connections
  table.insert(activeUpdateConnections, ws)

  -- For now, just acknowledge connection
  ws:Write({
    type = "connected",
    message = "Real-time updates endpoint ready"
  })

  ws.Closed = function()
    print('WebSocket client disconnected from /ws/updates')
    -- Remove from active connections
    for i, conn in ipairs(activeUpdateConnections) do
      if conn == ws then
        table.remove(activeUpdateConnections, i)
        break
      end
    end
  end
end)

-- Table to store component subscriptions
local componentSubscriptions = {}

-- Function to subscribe to a component and broadcast updates
local function subscribeToComponent(componentName)
  if componentSubscriptions[componentName] then
    print("Re-subscribing to component: " .. componentName .. " (clearing old subscription)")
    -- Clear old EventHandlers by setting them to nil
    local oldComponent = componentSubscriptions[componentName]
    local oldControlMetadata = Component.GetControls(componentName)
    for _, ctrlMeta in ipairs(oldControlMetadata) do
      pcall(function()
        local control = oldComponent[ctrlMeta.Name]
        if control then
          control.EventHandler = nil
        end
      end)
    end
    componentSubscriptions[componentName] = nil
  end

  local success, component = pcall(function()
    return Component.New(componentName)
  end)

  if not success or not component then
    print("Failed to subscribe to component: " .. componentName .. " - Error: " .. tostring(component))
    return
  end

  print("Setting up EventHandlers for component: " .. componentName)

  -- Get all control metadata to set up individual EventHandlers
  local controlMetadata = Component.GetControls(componentName)

  -- Throttle state for this component - use module-level timer storage
  if not subscriptionThrottleTimers[componentName] then
    subscriptionThrottleTimers[componentName] = nil
  end
  local pendingUpdate = false

  -- Function to broadcast all control updates
  local function broadcastControlUpdates()
    -- Get a fresh component instance for accessing current control values
    local currentComponent = Component.New(componentName)

    -- Build updated control list with current values
    local updatedControls = {}
    for _, ctrlMeta in ipairs(controlMetadata) do
      local success, controlData = pcall(function()
        local actualControl = currentComponent[ctrlMeta.Name]
        if not actualControl then
          return nil
        end

        -- Safely extract choices if available
        local choices = nil
        pcall(function()
          if actualControl.Choices and type(actualControl.Choices) == "table" then
            choices = {}
            for _, choice in ipairs(actualControl.Choices) do
              if type(choice) == "string" or type(choice) == "number" then
                table.insert(choices, tostring(choice))
              end
            end
          end
        end)

        -- Determine control type
        local controlType = ctrlMeta.Type or "Text"
        if choices and #choices > 0 then
          controlType = "Combo box"
        elseif (controlType ~= "Float" and controlType ~= "Integer") and (ctrlMeta.ValueMin ~= nil and ctrlMeta.ValueMax ~= nil) then
          -- Only change to Knob if it's not already Float or Integer
          controlType = "Knob"
        end

        -- Safely get control values
        local safeValue = nil
        local safePosition = nil
        local safeString = ""

        pcall(function()
          if type(actualControl.Value) == "number" then
            safeValue = actualControl.Value
          end
        end)

        pcall(function()
          if type(actualControl.Position) == "number" then
            safePosition = actualControl.Position
          end
        end)

        pcall(function()
          if type(actualControl.String) == "string" then
            safeString = actualControl.String
          end
        end)

        return {
          name = ctrlMeta.Name,
          type = controlType,
          direction = ctrlMeta.Direction or "Read/Write",
          value = safeValue,
          position = safePosition,
          string = safeString,
          choices = choices
        }
      end)

      if success and controlData then
        table.insert(updatedControls, controlData)
      end
    end

    -- Broadcast update to all connected clients
    for _, ws in ipairs(activeUpdateConnections) do
      if ws.IsConnected then
        ws:Write({
          type = "componentUpdate",
          componentName = componentName,
          controls = updatedControls
        })
      end
    end

    pendingUpdate = false
  end

  -- Throttled update function (max once per 500ms)
  local function requestUpdate()
    if not pendingUpdate then
      pendingUpdate = true

      -- Stop existing timer for this subscription if it exists
      if subscriptionThrottleTimers[componentName] then
        subscriptionThrottleTimers[componentName]:Stop()
      end

      -- Create new timer for this subscription's throttle
      subscriptionThrottleTimers[componentName] = Timer.New()
      subscriptionThrottleTimers[componentName].EventHandler = function(timer)
        timer:Stop()
        if pendingUpdate then
          broadcastControlUpdates()
        end
      end
      subscriptionThrottleTimers[componentName]:Start(0.5) -- 500ms throttle
    end
  end

  -- Set up EventHandler for each control
  local eventHandlerCount = 0
  for _, ctrlMeta in ipairs(controlMetadata) do
    local controlSuccess = pcall(function()
      local control = component[ctrlMeta.Name]
      if control then
        control.EventHandler = function()
          requestUpdate()
        end
        eventHandlerCount = eventHandlerCount + 1
      end
    end)
  end

  componentSubscriptions[componentName] = component
  print("✓ Successfully subscribed to component: " .. componentName .. " (" .. eventHandlerCount .. " controls)")
end

-- HTTP endpoint for component list (lightweight)
server:get('/api/components', function(req, res)
  local components = Component.GetComponents()
  local componentList = {}

  for _, comp in ipairs(components) do
    -- Get control count only
    local controlCount = 0
    local success, controls = pcall(function()
      return Component.GetControls(comp.Name)
    end)

    if success and controls then
      controlCount = #controls
    end

    table.insert(componentList, {
      name = comp.Name,
      type = comp.Type,
      controlCount = controlCount
    })
  end

  res:send({
    totalComponents = #componentList,
    components = componentList
  })
end)

-- HTTP endpoint for specific component's controls
server:get('/api/components/:componentName/controls', function(req, res)
  -- URL decode the component name
  local componentName = req.params.componentName:gsub("%%(%x%x)", function(hex)
    return string.char(tonumber(hex, 16))
  end)

  print("Fetching controls for component: " .. componentName)

  local success, controls = pcall(function()
    return Component.GetControls(componentName)
  end)

  if not success or not controls then
    print("Failed to get controls for " .. componentName)
    res:status(404)
    res:set('Content-Type', 'application/json')
    res:send('{"error":"Component not found or no controls available"}')
    return
  end

  print("Got " .. #controls .. " controls for " .. componentName)

  -- Get the component instance to access actual control properties including Choices
  local component = Component.New(componentName)
  local controlList = {}
  for i, ctrl in ipairs(controls) do
    -- Try to encode each control individually to find the problematic one
    local encodeSuccess, encodeResult = pcall(function()
      local safeCtrl = {}

      -- Only include basic string/number fields, exclude everything else
      if ctrl.Name and type(ctrl.Name) == "string" then
        safeCtrl.name = ctrl.Name
      end

      -- Get the actual control to access Choices property
      local actualControl = component[ctrl.Name]

      -- Safely extract choices from the actual control (wrapped in pcall for script controls)
      local choices = nil
      if actualControl then
        pcall(function()
          if actualControl.Choices and type(actualControl.Choices) == "table" then
            choices = {}
            for _, choice in ipairs(actualControl.Choices) do
              -- Only include primitive values, skip complex objects
              if type(choice) == "string" or type(choice) == "number" then
                table.insert(choices, tostring(choice))
              end
            end
          end
        end)
      end

      -- Determine the control type - if it has choices, it's a combo box; if it has ValueMin/ValueMax, it's a Knob
      local controlType = ctrl.Type or "Text"
      if choices and #choices > 0 then
        controlType = "Combo box"
      elseif (controlType ~= "Float" and controlType ~= "Integer") and (ctrl.ValueMin ~= nil and ctrl.ValueMax ~= nil) then
        -- Only change to Knob if it's not already Float or Integer
        controlType = "Knob"
      end
      safeCtrl.type = controlType

      if ctrl.Direction and type(ctrl.Direction) == "string" then
        safeCtrl.direction = ctrl.Direction
      else
        safeCtrl.direction = "Read/Write"
      end

      -- Only include numeric values
      if type(ctrl.Value) == "number" then
        safeCtrl.value = ctrl.Value
      end

      if type(ctrl.ValueMin) == "number" then
        safeCtrl.valueMin = ctrl.ValueMin
      end

      if type(ctrl.ValueMax) == "number" then
        safeCtrl.valueMax = ctrl.ValueMax
      end

      if type(ctrl.Position) == "number" then
        safeCtrl.position = ctrl.Position
      end

      -- Get string value from actual control for combo boxes, otherwise from metadata
      if actualControl and choices and #choices > 0 then
        -- For combo boxes, get the current string value from the actual control
        local stringSuccess = pcall(function()
          if type(actualControl.String) == "string" then
            safeCtrl.string = actualControl.String
          end
        end)
        if not stringSuccess or not safeCtrl.string then
          safeCtrl.string = ""
        end
      elseif type(ctrl.String) == "string" then
        -- For other controls, use metadata
        safeCtrl.string = ctrl.String
      else
        safeCtrl.string = ""
      end

      -- Include choices if available
      if choices then
        safeCtrl.choices = choices
      end

      -- Test if this control can be encoded
      local testEncode = json.encode(safeCtrl)

      return safeCtrl
    end)

    if encodeSuccess then
      table.insert(controlList, encodeResult)
    else
      print("Skipping control #" .. i .. " (" .. tostring(ctrl.Name) .. ") - encoding failed: " .. tostring(encodeResult))
    end
  end

  -- Try to encode the final response
  local responseData = {
    componentName = componentName,
    controlCount = #controlList,
    controls = controlList
  }

  local encodeSuccess, jsonString = pcall(function()
    return json.encode(responseData)
  end)

  if not encodeSuccess then
    print("Error encoding final response for " .. componentName .. ": " .. tostring(jsonString))
    res:status(500)
    res:set('Content-Type', 'application/json')
    res:send('{"error":"Failed to encode control data"}')
    return
  end

  -- Verify jsonString is actually a string
  print("Encoded response type: " .. type(jsonString) .. ", length: " .. #jsonString)

  -- Build HTTP response manually to avoid middleware issues
  local httpResponse = "HTTP/1.1 200 OK\r\n"
  httpResponse = httpResponse .. "Content-Type: application/json\r\n"
  httpResponse = httpResponse .. "Content-Length: " .. #jsonString .. "\r\n"
  httpResponse = httpResponse .. "Access-Control-Allow-Origin: *\r\n"
  httpResponse = httpResponse .. "Connection: close\r\n"
  httpResponse = httpResponse .. "\r\n"
  httpResponse = httpResponse .. jsonString

  -- Send raw HTTP response - get socket via rawget like WebSocket handler does
  local socket = rawget(res, 'socket')
  socket:Write(httpResponse)
  print("Send completed successfully")

  -- Subscribe to this component for future updates
  subscribeToComponent(componentName)
end)

-- HTTP endpoint to set a control value
server:post('/api/components/:componentName/controls/:controlName', function(req, res)
  -- URL decode the component and control names
  local componentName = req.params.componentName:gsub("%%(%x%x)", function(hex)
    return string.char(tonumber(hex, 16))
  end)
  local controlName = req.params.controlName:gsub("%%(%x%x)", function(hex)
    return string.char(tonumber(hex, 16))
  end)

  print("Setting control: " .. componentName .. "." .. controlName)

  -- Get the value from request body
  local value = req.body and req.body.value

  if value == nil then
    res:status(400)
    res:set('Content-Type', 'application/json')
    local socket = rawget(res, 'socket')
    socket:Write('HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n{"error":"Missing value in request body"}')
    return
  end

  -- Get the component
  local success, component = pcall(function()
    return Component.New(componentName)
  end)

  if not success or not component then
    print("Component not found: " .. componentName)
    res:status(404)
    res:set('Content-Type', 'application/json')
    local socket = rawget(res, 'socket')
    socket:Write('HTTP/1.1 404 Not Found\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n{"error":"Component not found"}')
    return
  end

  -- Get the control
  local control = component[controlName]
  if not control then
    print("Control not found: " .. controlName .. " on component: " .. componentName)
    print("Available controls on this component:")
    local controls = Component.GetControls(componentName)
    for i, ctrl in ipairs(controls) do
      print("  - " .. ctrl.Name)
      if i > 10 then
        print("  ... (showing first 10 of " .. #controls .. " controls)")
        break
      end
    end
    res:status(404)
    res:set('Content-Type', 'application/json')
    local socket = rawget(res, 'socket')
    socket:Write('HTTP/1.1 404 Not Found\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n{"error":"Control not found"}')
    return
  end

  -- Set the control value based on its type
  local setSuccess, setError = pcall(function()
    print('control.Type: '..control.Type..', control.Value.Type: '..type(control.Value))
    print('value.Type: '..type(value)..', value: '..tostring(value))
    
    -- Check control type first (most reliable way to determine how to set value)
    if control.Type=='Text' then -- String control
      print('String control')
      control.String = tostring(value)
    elseif control.Type=='Trigger' then -- Trigger control
      print('control:Trigger()')
      control:Trigger()
    elseif control.Type=='Boolean' then --Momentary or Toggle
      print('Boolean control')
      control.Boolean = tonumber(value)>0
    elseif control.Type=='Knob' then -- Knob/Fader control (uses Position 0-1)
      print('Knob control - setting Position to '..tostring(value))
      control.Position = value
    elseif control.Type=='Float' or control.Type=='Integer' then -- Numeric input control (uses Value)
      print('Numeric control - setting Value to '..tostring(value))
      control.Value = value
    elseif control.Type=='State Trigger' then -- State Trigger control
      print('State Trigger control')
      control.Value = value
      control:Trigger()
    else
      -- Default: try setting Value for numeric types, otherwise treat as string
      if type(value) == "number" then
        print('Unspecified numeric control - setting Value')
        control.Value = value
      else
        print('Unspecified control type - treating as string')
        control.String = tostring(value)
      end
    end
  end)


  if not setSuccess then
    print("Failed to set control: " .. tostring(setError))
    res:status(500)
    res:set('Content-Type', 'application/json')
    local socket = rawget(res, 'socket')
    socket:Write('HTTP/1.1 500 Internal Server Error\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n{"error":"Failed to set control"}')
    return
  end

  print("Control set successfully")

  -- Send success response
  local socket = rawget(res, 'socket')
  socket:Write('HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n{"success":true}')
  
  -- Subscribe to this component to broadcast the updated value to any connected clients
  subscribeToComponent(componentName)
end)

-- ========== File Browser WebSocket Endpoint ==========
--[[
  File System Browser via WebSocket
  Provides directory listing and file operations using Q-SYS dir library
  Protocol: JSON messages with type field

  Message types:
  - Client -> Server: { type: "list", path: "/media/audio" }
  - Server -> Client: { type: "list", path: "/media/audio", entries: [{name, type, size}] }
  - Server -> Client: { type: "error", error: "error message" }
]]

server:ws('/ws/file-system', function(ws)
  print('File browser WebSocket client connected')

  -- Send welcome message
  ws:Write({
    type = 'connected',
    message = 'File browser connected to Q-SYS Core'
  })

  -- Get the underlying socket to set message handler
  local socket = ws.socket

  -- Handle incoming messages via the handlers table
  if socket then
    server._wsMessageHandlers[socket] = function(_, data)
      print('File browser: Received message: ' .. tostring(data))

      local success, message = pcall(function()
        return json.decode(data)
      end)

      if not success then
        print('File browser: Invalid JSON: ' .. tostring(message))
        ws:Write({
          type = 'error',
          error = 'Invalid JSON'
        })
        return
      end

      -- Handle list directory request
      if message.type == 'list' then
        local path = message.path or 'design/'
        -- Ensure path ends with '/' for dir.get() API
        if not path:match('/$') then
          path = path .. '/'
        end
        print('File browser: Listing directory: ' .. path)

        -- Use dir.get() to list directory contents (Q-SYS API)
        local listSuccess, entries = pcall(function()
          return dir.get(path)
        end)

        if not listSuccess then
          print('File browser: Failed to list directory: ' .. tostring(entries))
          ws:Write({
            type = 'error',
            path = path,
            error = 'Failed to access directory: ' .. tostring(entries)
          })
          return
        end

        -- Transform entries to our format
        local fileEntries = {}
        if entries then
          for _, entry in ipairs(entries) do
            table.insert(fileEntries, {
              name = entry.name,
              type = entry.type, -- 'file' or 'directory'
              size = entry.size or 0
            })
          end
        end

        print('File browser: Found ' .. #fileEntries .. ' entries')

        -- Send response
        ws:Write({
          type = 'list',
          path = path,
          entries = fileEntries
        })

      -- Handle read file request
      elseif message.type == 'read' then
        local filePath = message.path
        if not filePath then
          ws:Write({
            type = 'error',
            error = 'No file path provided'
          })
          return
        end

        print('File browser: Reading file: ' .. filePath)

        -- Detect content type based on file extension
        local function getContentType(fileName)
          local ext = fileName:match('%.([^%.]+)$')
          if not ext then return 'application/octet-stream' end
          ext = ext:lower()

          -- Text types
          if ext == 'txt' then return 'text/plain' end
          if ext == 'lua' then return 'text/plain' end
          if ext == 'js' then return 'text/javascript' end
          if ext == 'json' then return 'application/json' end
          if ext == 'xml' then return 'application/xml' end
          if ext == 'html' then return 'text/html' end
          if ext == 'css' then return 'text/css' end
          if ext == 'log' then return 'text/plain' end

          -- Image types
          if ext == 'jpg' or ext == 'jpeg' then return 'image/jpeg' end
          if ext == 'png' then return 'image/png' end
          if ext == 'gif' then return 'image/gif' end
          if ext == 'bmp' then return 'image/bmp' end
          if ext == 'svg' then return 'image/svg+xml' end

          -- Audio types
          if ext == 'wav' then return 'audio/wav' end
          if ext == 'mp3' then return 'audio/mpeg' end
          if ext == 'aac' then return 'audio/aac' end
          if ext == 'flac' then return 'audio/flac' end
          if ext == 'ogg' then return 'audio/ogg' end

          -- Video types
          if ext == 'mp4' then return 'video/mp4' end
          if ext == 'avi' then return 'video/x-msvideo' end
          if ext == 'mov' then return 'video/quicktime' end
          if ext == 'mkv' then return 'video/x-matroska' end
          if ext == 'webm' then return 'video/webm' end

          return 'application/octet-stream'
        end

        local contentType = getContentType(filePath)

        -- Read file content
        local readSuccess, content = pcall(function()
          local file = io.open(filePath, 'rb')
          if not file then
            error('Failed to open file')
          end
          local data = file:read('*all')
          file:close()
          return data
        end)

        if not readSuccess then
          print('File browser: Failed to read file: ' .. tostring(content))
          ws:Write({
            type = 'error',
            path = filePath,
            error = 'Failed to read file: ' .. tostring(content)
          })
          return
        end

        -- Convert binary content to base64 for non-text files
        local responseContent = content
        if not contentType:match('^text/') and contentType ~= 'application/json' and contentType ~= 'application/xml' then
          -- Base64 encode for binary files (media files) using Q-SYS native function
          responseContent = Crypto.Base64Encode(content)
        end

        print('File browser: Successfully read file, size: ' .. #content .. ' bytes, type: ' .. contentType)

        ws:Write({
          type = 'read',
          path = filePath,
          content = responseContent,
          contentType = contentType
        })

      else
        ws:Write({
          type = 'error',
          error = 'Unknown message type: ' .. tostring(message.type)
        })
      end
    end
  else
    print('ERROR: Could not set up file browser message handler - socket not found')
  end

  ws.Closed = function()
    print('File browser WebSocket client disconnected')
  end
end)

-- Start server
function Listen()
  if Controls.port.Value == 0 then Controls.port.Value = 9091 end
  server:listen(Controls.port.Value)
end
Controls.port.EventHandler = Listen
Listen()

print(('HTTP Server with WebSocket support started on port %.f'):format(Controls.port.Value))
print(('WebSocket endpoint: ws://[CORE-IP]:%.f/ws/discovery'):format(Controls.port.Value))
print(('WebSocket endpoint: ws://[CORE-IP]:%.f/ws/file-system'):format(Controls.port.Value))
print(('HTTP API endpoint: http://[CORE-IP]:%.f/api/components'):format(Controls.port.Value))

-- ========== SECURE DISCOVERY OVERLAY ==========
-- If the required controls exist, enable secure discovery via QRC tunneling

-- Shared function to generate discovery JSON (reused by both modes)
-- Note: In the legacy code, this logic was inside the route handler. 
-- We need to extract it, but since the legacy code is complex and closures might be an issue,
-- we will create a dedicated generator here that replicates the logic for the secure path,
-- or ideally, refactor the route to use this.
-- For minimal risk to legacy, we will duplicate the "gathering" logic for the secure path first.

function GenerateSecureDiscoveryJson()
  local components = Component.GetComponents()
  local componentList = {}

  for _, cmp in ipairs(components) do
    if cmp.Name and cmp.Name ~= "" then
      -- Get control count via GetControls
      local controlCount = 0
      local success, controls = pcall(function()
        return Component.GetControls(cmp.Name)
      end)
      
      if success and controls then
        controlCount = #controls
      end

      table.insert(componentList, {
        name = cmp.Name,
        type = cmp.Type or "Unknown",
        controlCount = controlCount,
        controls = {}, -- Don't send all controls in discovery to keep payload small
        properties = cmp.Properties or {}
      })
    end
  end

  return require('rapidjson').encode({
    timestamp = os.time(),
    totalComponents = #componentList,
    components = componentList
  })
end

-- Chunking constants for Text Control output (limit is usually 64KB, but we stay safe)
local CHUNK_SIZE = 40000 

if Controls.json_output and Controls.trigger_update then
  print("Secure Discovery Controls detected. Enabling QRC Tunnel.")
  
  -- Function to write JSON to output control with chunking
  local function WriteJsonToControl(jsonStr)
    if not Controls.json_output then
      print("Warning: json_output control not available, cannot write discovery data")
      return
    end
    
    if #jsonStr <= CHUNK_SIZE then
      -- Fits in one chunk
      Controls.json_output.String = jsonStr
    else
      -- Needs chunking
      -- Reset status
      Controls.json_output.String = "START:" .. math.ceil(#jsonStr / CHUNK_SIZE)
      
      -- Helper to split string
      local chunks = {}
      for i = 1, #jsonStr, CHUNK_SIZE do
        table.insert(chunks, string.sub(jsonStr, i, i + CHUNK_SIZE - 1))
      end
      
      -- Write chunks sequentially
      -- Note: In a real async environment, we might need delays, but Q-SYS Lua is single threaded events.
      -- Writing to a control triggers an update. For the client to catch all, 
      -- we might need a protocol. 
      -- Simple Protocol: "CHUNK:index:total:data"
      
      for i, chunk in ipairs(chunks) do
        Controls.json_output.String = string.format("CHUNK:%d:%d:%s", i, #chunks, chunk)
      end
      
      Controls.json_output.String = "END"
    end
  end

  Controls.trigger_update.EventHandler = function()
    print("Received Secure Discovery Request via Trigger")
    local jsonStr = GenerateSecureDiscoveryJson()
    WriteJsonToControl(jsonStr)
  end
else
  print("Secure Discovery Controls NOT detected. Running in Legacy Mode only.")
end

-- ========== QRWC Connection State Monitor ==========
-- Periodically check if QRWC connection state has changed and reinitialize handlers if reconnected
local function CheckQRWCConnectionState()
  -- Check if System is still connected to QRWC (safe check for control access)
  local currentConnectionState = pcall(function() return Controls.port ~= nil end)
  
  if currentConnectionState and not lastQRWCConnectionState then
    -- Transition: reconnected (was disconnected, now connected)
    print(">>> QRWC RECONNECTION DETECTED - Re-establishing control handlers")
    ReinitializeControlHandlers()
    lastQRWCConnectionState = true
  elseif not currentConnectionState then
    -- State: disconnected
    if lastQRWCConnectionState then
      print(">>> QRWC DISCONNECTION DETECTED - Control handlers may be invalid")
    end
    lastQRWCConnectionState = false
  end
end

-- Schedule periodic QRWC connection checks (every 2 seconds)
if not reconnectionCheckTimer or not reconnectionCheckTimer:Running() then
  reconnectionCheckTimer = Timer.New()
  reconnectionCheckTimer.EventHandler = CheckQRWCConnectionState
  reconnectionCheckTimer:Start(2)
  print("Started QRWC connection state monitor (checks every 2 seconds)")
end

