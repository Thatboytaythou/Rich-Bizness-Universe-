import {ROUTES} from '../../core/config/routes';

export type District='personal'|'city'|'creative';
export type WorldAction={id:string;label:string;description:string;x:number;z:number;href?:string;effect?:'lighting'};
export type Bounds={minX:number;maxX:number;minZ:number;maxZ:number};
export type DistrictDefinition={title:string;slug:string;description:string;bounds:Bounds;spawn:[number,number];actions:WorldAction[]};
export const DISTRICTS:Record<District,DistrictDefinition>={
  personal:{title:'Personal Residence',slug:'rb-personal-residence',description:'Your own solo living space. Change the lighting, customize your character and travel to the other districts.',bounds:{minX:-5.2,maxX:5.2,minZ:-11,maxZ:5},spawn:[0,2.4],actions:[
    {id:'lighting',label:'Lighting console',description:'Switch the residence between daylight and evening.',x:3.6,z:-3.4,effect:'lighting'},
    {id:'wardrobe',label:'Wardrobe',description:'Edit your persistent Rich ID appearance.',x:-3.5,z:-6.5,href:ROUTES.avatarCharacters},
    {id:'identity',label:'Identity desk',description:'View your saved profile.',x:3.5,z:-8.6,href:ROUTES.profile},
    {id:'city',label:'Living City',description:'Travel to the city district.',x:0,z:-10,href:ROUTES.avatar+'?district=city'}
  ]},
  city:{title:'Living City',slug:'rb-living-city',description:'Explore the central avenue, visit the commerce and social destinations, or travel through Omni.',bounds:{minX:-5.8,maxX:5.8,minZ:-78,maxZ:5.5},spawn:[0,1.6],actions:[
    {id:'home',label:'Residence',description:'Return to your solo residence.',x:-2.6,z:-7,href:ROUTES.avatar+'?district=personal'},
    {id:'market',label:'Commerce',description:'Open the existing Rich Bizness Store.',x:2.6,z:-15,href:ROUTES.store},
    {id:'social',label:'Social square',description:'Open World Exchange and social rooms.',x:0,z:-26,href:ROUTES.meta+'?world=rb-living-city'},
    {id:'creative',label:'Creative District',description:'Enter the recording and entertainment space.',x:0,z:-38,href:ROUTES.avatar+'?district=creative'}
  ]},
  creative:{title:'Creative District',slug:'rb-creative-district',description:'A recording and exhibition space connected to real music, uploads, gallery and live tools.',bounds:{minX:-5.4,maxX:5.4,minZ:-15,maxZ:5},spawn:[0,2.8],actions:[
    {id:'music',label:'Recording console',description:'Open Music and your creator catalog.',x:0,z:-7,href:ROUTES.music},
    {id:'upload',label:'Publish station',description:'Open the existing media upload system.',x:-3.5,z:-3,href:ROUTES.upload},
    {id:'gallery',label:'Gallery wall',description:'Open the media gallery.',x:3.5,z:-4,href:ROUTES.gallery},
    {id:'live',label:'Broadcast booth',description:'Open Live entertainment.',x:3.5,z:-12,href:ROUTES.live},
    {id:'city',label:'Living City',description:'Return to the central avenue.',x:0,z:-14,href:ROUTES.avatar+'?district=city'}
  ]}
};
export function resolveDistrict(value:string|null):District{return value==='personal'||value==='creative'?value:'city';}
export function districtForSlug(slug:string):District|undefined{return (Object.keys(DISTRICTS) as District[]).find(k=>DISTRICTS[k].slug===slug);}
export function districtHref(district:District):string{return ROUTES.avatar+'?district='+district;}
