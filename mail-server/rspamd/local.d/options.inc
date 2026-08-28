# Global Rspamd options — milter listens on 11332 for Postfix.

local_ip = "0.0.0.0";
milter = true;
milter_mailbox = "dummy";
milter_headers = true;

# Greylisting enabled via override in greylist.conf
