# Normal worker — bind milter port Postfix connects to.

bind_socket = "0.0.0.0:11332";
count = 1;
max_tasks = 256;

milter {
  bind_socket = "0.0.0.0:11332";
}
