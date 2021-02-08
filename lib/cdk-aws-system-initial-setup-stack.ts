import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as rds from '@aws-cdk/aws-rds';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as autoscaling from '@aws-cdk/aws-autoscaling';
import * as acm from '@aws-cdk/aws-certificatemanager';



export class CdkAwsSystemInitialSetupStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(
      this, 
      'system-vpc',
      {
        cidr: "10.101.0.0/16",
        natGateways: 0,
        subnetConfiguration: [
          {
            cidrMask: 24,
            name: 'system-ingress',
            subnetType: ec2.SubnetType.PUBLIC,
          },
        ],
      }
    );

    // Pick the right Amazon Linux edition. All arguments shown are optional
    // and will default to these values when omitted.
    const amznLinux = ec2.MachineImage.latestAmazonLinux(
      {
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
        edition: ec2.AmazonLinuxEdition.STANDARD,
        virtualization: ec2.AmazonLinuxVirt.HVM,
        storage: ec2.AmazonLinuxStorage.GENERAL_PURPOSE,
      }
    );
  
    const asgSG = new ec2.SecurityGroup(
      this, 
      'ASGSecurityGroup', 
      { 
        vpc, 
        securityGroupName: 'ASGSecurityGroup',
        description: 'Base SG for HTTP Traffic'
      }
    );
    
    const asg = new autoscaling.AutoScalingGroup(
      this,
      'sys-ASG',
      {
        vpc,
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MICRO),
        machineImage: amznLinux,
        minCapacity: 1,
        maxCapacity: 1,
        associatePublicIpAddress: false,
        securityGroup: asgSG
      }
    );
    

    // Append these SGs to the instance

    asg.addUserData(
      "yum -y update",
      "yum -y install amazon-linux-extras",
      "yum -y install https://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm",
      "yum -y install http://rpms.remirepo.net/enterprise/remi-release-7.rpm",
      "yum -y install yum-utils",
      "yum-config-manager --enable remi-php56",
      "yum -y install php56 php56 php56-php-bcmath php56-php-cli php56-php-common php56-php-gd php56-php-pecl-jsonc php56-php-mbstring php56-php-mcrypt php56-php-mysqlnd php56-php-pdo php56-php-process php56-php-xml",
      "yum -y install httpd",
      "yum -y install mariadb",
      "echo '<html><body>Healthy</body></html>' > /var/www/html/index.html",
      "systemctl enable httpd",
      "systemctl start httpd",
      "echo 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCnpJF0IOs35WGtRQEQVWJUZBGF2EqjaT3SuuengbxXLscLUKOT3V2SfsB0Rd+h0WBfVJfuHtCKvMEvpjna1ZJyAisusc4MWBZTLOEHX7fsMlz+Hg0/VVrpDNCGvPcMm4NE5ghyXT/CqYdMe1l1FbAaJNJI3A/sWuYIrYKwtBko11cTcgzQCFH/qEyDM/KpjQKhoju+rNfTt8ACwOpoeefdpPKjBbQzcYORUNgBtbwmN06xpWGK3wMqkWzNCOl26/N7txeu6DJ6FHi+7RynUhZSaKFUhumFqlKoRJbiNx0aGoTIj/bJ8mPltDm1rwmx0xgwtaQ4JORdiK0+cP7r5E0v ansible@dc0-ansible' >> /home/ec2-user/.ssh/authorized_keys",
      "echo 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDRjugjN0II8EWNdE77rbWYAEOhjSQBWZHCti53BujqTo+kIVIT7TSjA1Bn9xanU8bvUzYh0P/JVMjwTT8rGt2nOahXCw+hPLuRc7te6CeAX7BIbOsx5dKzEtgaYJQvwcA2EevCGKWQvWlLPP8s3nXp+00AyPpGBA6Jthxo6k1/I1nmM8Hrtafsa1QPB4fTStfrEjGvUSZPVN+Usa7Z4Zhzl7RA6wQRlX3UUK6x57ZPyjbKvR20ICW7n5hgKB9QOjtlsvUr6QrQb1gpOYQ+wGMGXGoZ6zslOjYEwXcq4+4lEkux7grnRAcAgZyigha25P78n23Gmqckqqpn531CpcoX jenkins@dc0-jenkins-p1a' >> /home/ec2-user/.ssh/authorized_keys",
      "systemctl restart sshd"
    )

    const mysqlSecurityGroup = new ec2.SecurityGroup(
      this,
      'system-sg-mysql',
      {
        vpc,
        securityGroupName: 'RDSSecurityGroupMYSQL',
        description: 'Allow MySQL access to RDS instance from VPC',
        allowAllOutbound: true   // Can be set to false
      }
    );
    mysqlSecurityGroup.addIngressRule(ec2.Peer.ipv4("10.101.0.0/16"), ec2.Port.tcp(3306), 'Allow MySQL access from the VPC');

    const mysqlExternalSecurityGroup = new ec2.SecurityGroup(
      this,
      'system-sg-mysql-ext',
      {
        vpc,
        securityGroupName: 'RDSSecurityGroupMYSQLEXT',
        description: 'Allow MySQL access to RDS instance externally',
        allowAllOutbound: true   // Can be set to false
      }
    );
    mysqlExternalSecurityGroup.addIngressRule(ec2.Peer.ipv4("10.0.0.0/16"), ec2.Port.tcp(3306), 'Allow MySQL access from on-prem');

    const mySQLRDSInstance = new rds.DatabaseInstance(
      this,
      'mysql-rds-instance',
      {
        engine: rds.DatabaseInstanceEngine.MARIADB,
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
        vpc: vpc,
        vpcPlacement: {subnetType: ec2.SubnetType.PUBLIC},
        securityGroups: [mysqlSecurityGroup, mysqlExternalSecurityGroup],
        storageEncrypted: false,
        multiAz: false,
        autoMinorVersionUpgrade: false,
        allocatedStorage: 20,
        storageType: rds.StorageType.GP2,
        deletionProtection: false,
        databaseName: 'db_change_log',
        port: 3306
      }
    );


    const acmCert = new acm.Certificate(
      this,
      'Certificate',
      {
        domainName: '*.example.com',
        validation: acm.CertificateValidation.fromDns(), // Records must be added manually
      }
    );

    const albSGDefault = new ec2.SecurityGroup(
      this, 
      'ALBSecurityGroupDefault', 
      {
        vpc,
        securityGroupName: 'ALBSecurityGroupDefault',
        description: 'Base SG for ALB ALL Traffic external'
      }
    );
    const albSGSSH = new ec2.SecurityGroup(
      this, 
      'ALBSecurityGroupSSH', 
      {
        vpc,
        securityGroupName: 'ALBSecurityGroupSSH',
        description: 'Base SG for ALB SSH Traffic external'
      }
    );
    albSGDefault.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP Traffic from anywhere');
    albSGDefault.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow HTTP Traffic from anywhere');
    // Create the load balancer in a VPC. 'internetFacing' is 'false'
    // by default, which creates an internal load balancer.
    const alb = new elbv2.ApplicationLoadBalancer(
      this,
      'system-ALB',
      {
        vpc,
        internetFacing: true,
        securityGroup: albSGDefault
      }
    );
    alb.addSecurityGroup(albSGSSH);

    // ASG allow traffic from ALBs
    asgSG.addIngressRule(albSGDefault, ec2.Port.tcp(80), 'Allow HTTP Traffic from ALB');
    asgSG.addIngressRule(albSGSSH, ec2.Port.tcp(22), 'Allow SSH Traffic from ALB');

    alb.addRedirect({
      sourceProtocol: elbv2.ApplicationProtocol.HTTP,
      sourcePort: 80,
      targetProtocol: elbv2.ApplicationProtocol.HTTPS,
      targetPort: 443,
    });

    const albhttpslistener = alb.addListener(
      'HTTPSListener',
      {
        port: 443,
        open: false
      }
    );
    albhttpslistener.addCertificates(
      'main-cert', 
      [
        acmCert
      ]
    );
    albhttpslistener.addTargets(
      'sys-ASG-fleet-https',
      {
        port: 80,
        targets: [asg]
      }
    );
  }
}
