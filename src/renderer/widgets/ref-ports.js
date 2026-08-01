"use strict";
window.I18N.register({
    en: { "widget.ref_ports": "Well-Known Ports", "cat.reference": "Reference" },
    ru: { "widget.ref_ports": "Известные порты", "cat.reference": "Справочник" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.ref_ports = {
    id: "ref_ports",
    title: "widget.ref_ports",
    category: "reference",
    description: "Searchable well-known port numbers list",
    defaultSize: { w: 8, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const PORTS = [
            [20, "tcp", "FTP-DATA", "FTP data transfer"],
            [21, "tcp", "FTP", "FTP control"],
            [22, "tcp", "SSH", "Secure Shell / SCP / SFTP"],
            [23, "tcp", "Telnet", "Unencrypted remote login"],
            [25, "tcp", "SMTP", "Mail transfer"],
            [53, "tcp/udp", "DNS", "Domain Name System"],
            [67, "udp", "DHCP", "DHCP server (BOOTP)"],
            [68, "udp", "DHCP", "DHCP client"],
            [69, "udp", "TFTP", "Trivial FTP"],
            [80, "tcp", "HTTP", "Web / HTTP"],
            [88, "tcp/udp", "Kerberos", "Kerberos authentication"],
            [110, "tcp", "POP3", "Post Office Protocol v3"],
            [111, "tcp/udp", "RPC", "ONC RPC / portmapper"],
            [123, "udp", "NTP", "Network Time Protocol"],
            [135, "tcp", "MS-RPC", "Windows RPC endpoint mapper"],
            [137, "udp", "NetBIOS", "NetBIOS name service"],
            [139, "tcp", "NetBIOS", "NetBIOS session service"],
            [143, "tcp", "IMAP", "Mail retrieval"],
            [161, "udp", "SNMP", "Network management"],
            [162, "udp", "SNMP-Trap", "SNMP traps"],
            [179, "tcp", "BGP", "Border Gateway Protocol"],
            [389, "tcp/udp", "LDAP", "Directory access"],
            [443, "tcp", "HTTPS", "HTTP over TLS"],
            [445, "tcp", "SMB", "Microsoft SMB / CIFS"],
            [465, "tcp", "SMTPS", "SMTP over TLS"],
            [500, "udp", "IKE", "IPsec / ISAKMP"],
            [514, "udp", "Syslog", "System logging"],
            [515, "tcp", "LPD", "Line printer daemon"],
            [587, "tcp", "SMTP", "Mail submission (STARTTLS)"],
            [636, "tcp", "LDAPS", "LDAP over TLS"],
            [873, "tcp", "rsync", "rsync file sync"],
            [993, "tcp", "IMAPS", "IMAP over TLS"],
            [995, "tcp", "POP3S", "POP3 over TLS"],
            [1080, "tcp", "SOCKS", "SOCKS proxy"],
            [1194, "udp", "OpenVPN", "OpenVPN"],
            [1433, "tcp", "MSSQL", "Microsoft SQL Server"],
            [1521, "tcp", "Oracle", "Oracle database"],
            [1723, "tcp", "PPTP", "PPTP VPN"],
            [2049, "tcp/udp", "NFS", "Network File System"],
            [2181, "tcp", "ZooKeeper", "Apache ZooKeeper client"],
            [2375, "tcp", "Docker", "Docker API (unencrypted)"],
            [2376, "tcp", "Docker", "Docker API (TLS)"],
            [2379, "tcp", "etcd", "etcd client API"],
            [3000, "tcp", "Dev/Grafana", "Common dev server / Grafana"],
            [3128, "tcp", "Squid", "Squid HTTP proxy"],
            [3306, "tcp", "MySQL", "MySQL / MariaDB"],
            [3389, "tcp", "RDP", "Remote Desktop"],
            [4444, "tcp", "Metasploit", "Common C2 / Selenium"],
            [5000, "tcp", "Dev/Flask", "Flask dev / UPnP / registry"],
            [5060, "tcp/udp", "SIP", "VoIP signaling"],
            [5432, "tcp", "PostgreSQL", "PostgreSQL database"],
            [5601, "tcp", "Kibana", "Kibana dashboard"],
            [5672, "tcp", "AMQP", "RabbitMQ / AMQP"],
            [5900, "tcp", "VNC", "VNC remote desktop"],
            [6379, "tcp", "Redis", "Redis key-value store"],
            [6443, "tcp", "Kubernetes", "Kube API server"],
            [7000, "tcp", "Cassandra", "Cassandra inter-node"],
            [8000, "tcp", "HTTP-alt", "Common alt HTTP / dev"],
            [8080, "tcp", "HTTP-alt", "HTTP proxy / Tomcat"],
            [8081, "tcp", "HTTP-alt", "Nexus / alt HTTP"],
            [8443, "tcp", "HTTPS-alt", "Alt HTTPS"],
            [8888, "tcp", "HTTP-alt", "Jupyter / alt HTTP"],
            [9000, "tcp", "SonarQube", "SonarQube / PHP-FPM / MinIO"],
            [9042, "tcp", "Cassandra", "Cassandra CQL native"],
            [9090, "tcp", "Prometheus", "Prometheus server"],
            [9092, "tcp", "Kafka", "Apache Kafka broker"],
            [9200, "tcp", "Elasticsearch", "Elasticsearch HTTP"],
            [9300, "tcp", "Elasticsearch", "Elasticsearch transport"],
            [11211, "tcp/udp", "Memcached", "Memcached cache"],
            [15672, "tcp", "RabbitMQ", "RabbitMQ management UI"],
            [25565, "tcp", "Minecraft", "Minecraft server"],
            [27017, "tcp", "MongoDB", "MongoDB database"]
        ];
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px">
              <input id="_pt_q" placeholder="Search port or service… e.g. 443, redis, mysql" style="width:100%;box-sizing:border-box;background:var(--bg-elevated);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 8px;font-family:var(--font-mono);font-size:12px">
              <div id="_pt_list" style="overflow:auto;flex:1"></div>
            </div>`;
        const q = body.querySelector("#_pt_q");
        const list = body.querySelector("#_pt_list");
        const render = () => {
            const s = q.value.trim().toLowerCase();
            const rows = PORTS.filter(([p, pr, n, d]) => !s || String(p).includes(s) || n.toLowerCase().includes(s) || d.toLowerCase().includes(s) || pr.includes(s));
            if (!rows.length) { list.innerHTML = `<div style="color:var(--text-dim);font-size:12px;padding:8px">No matches.</div>`; return; }
            list.innerHTML = `<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">` +
                rows.map(([p, pr, n, d]) => `<tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:4px 8px;font-weight:600;color:var(--accent);vertical-align:top;font-variant-numeric:tabular-nums">${p}</td>
                    <td style="padding:4px 8px;color:var(--text-dim);vertical-align:top;white-space:nowrap">${esc(pr)}</td>
                    <td style="padding:4px 8px;color:var(--text);white-space:nowrap;vertical-align:top">${esc(n)}</td>
                    <td style="padding:4px 8px;color:var(--text-dim)">${esc(d)}</td></tr>`).join("") + `</table>`;
        };
        q.addEventListener("input", render);
        render();
        return { destroy: () => q.removeEventListener("input", render) };
    }
};
