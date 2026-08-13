import { MdAddCircleOutline, MdEdit, MdMenu, MdOutlineDarkMode, MdRefresh } from "react-icons/md";
import { FaTrashAlt } from "react-icons/fa";
import { CiLight } from "react-icons/ci";
import { TbDotsVertical, TbShare2 } from "react-icons/tb";
import type { IconType } from "react-icons";
import type { MouseEventHandler } from "react";
import styles from './icon.module.css';

export type IconVariant = 'add' | 'edit' | 'delete' | 'light' | 'dark' | 'dots' | 'share' | 'refresh' | 'menu';

interface IconProps {
    className?: string;
    handleClick?: MouseEventHandler<SVGElement>;
    variant?: IconVariant;
    id?: string;
}

const Icon = ({ className, handleClick, variant = 'add', id }: IconProps) => {
    const iconsByVariant: Record<IconVariant, IconType> = {
        add: MdAddCircleOutline,
        edit: MdEdit,
        delete: FaTrashAlt,
        light: CiLight,
        dark: MdOutlineDarkMode,
        dots: TbDotsVertical,
        share: TbShare2,
        refresh: MdRefresh,
        menu: MdMenu
    };
    const IconComponent = iconsByVariant[variant] || MdAddCircleOutline;
    return <IconComponent className={`${styles.icon} ${className ? styles[className] : ''}`} onClick={handleClick} data-type={variant} id={id} />;
};

export default Icon;
