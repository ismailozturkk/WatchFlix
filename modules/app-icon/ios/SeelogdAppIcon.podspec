Pod::Spec.new do |s|
  s.name           = 'SeelogdAppIcon'
  s.version        = '1.0.0'
  s.summary        = 'Seelogd uygulama simgesi değiştirme köprüsü.'
  s.description    = 'UIApplication.setAlternateIconName üzerine ince yerel Expo modülü.'
  s.author         = 'Seelogd'
  s.homepage       = 'https://github.com/smlztrk/seelogd'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
