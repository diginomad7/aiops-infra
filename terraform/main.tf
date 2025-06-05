terraform {
  required_providers {
    virtualbox = {
      source  = "terra-farm/virtualbox"
      version = "0.2.2-alpha.1"
    }
  }
}

provider "virtualbox" {}

resource "virtualbox_vm" "aiops-node" {
  count    = 1
  name     = "aiops-node-${count.index + 1}"
  image    = "${path.module}/ubuntu.box"
  cpus     = 2
  memory   = "2048 mib"

  network_adapter {
    type           = "hostonly"
    host_interface = "vboxnet0"
  }
}

