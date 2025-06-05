# Vagrantfile для развёртывания кластера K3s из 3 нод с Host-only сетью

VAGRANTFILE_API_VERSION = "2"

NODES = [
  { :name => "aiops-node1", :ip => "192.168.56.11", :role => "master", :memory => 4096, :cpus => 4 },
  { :name => "aiops-node2", :ip => "192.168.56.12", :role => "master", :memory => 4096, :cpus => 4 },
  { :name => "aiops-node3", :ip => "192.168.56.13", :role => "worker", :memory => 4096, :cpus => 4 }
]

Vagrant.configure(VAGRANTFILE_API_VERSION) do |config|
  config.vm.box = "ubuntu/jammy64"
  config.vm.box_check_update = true

  NODES.each do |node|
    config.vm.define node[:name] do |node_config|
      node_config.vm.hostname = node[:name]
      node_config.vm.network "private_network", ip: node[:ip]

      node_config.vm.provider "virtualbox" do |vb|
        vb.memory = node[:memory]
        vb.cpus = node[:cpus]
        vb.customize ["modifyvm", :id, "--ioapic", "on"]
        vb.customize ["modifyvm", :id, "--natdnshostresolver1", "on"]
      end

      node_config.vm.provision "shell", inline: <<-SHELL
        apt-get update
        apt-get install -y curl wget vim git net-tools ntp
        systemctl start ntp
        systemctl enable ntp
        # Базовые настройки безопасности
        sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
        sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
        systemctl restart sshd
      SHELL
    end
  end
end

